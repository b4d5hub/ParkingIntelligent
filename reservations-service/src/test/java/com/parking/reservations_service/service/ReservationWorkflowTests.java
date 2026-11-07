package com.parking.reservations_service.service;

import com.parking.reservations_service.dto.*;
import com.parking.reservations_service.entity.*;
import com.parking.reservations_service.integration.ParkingGateway;
import com.parking.reservations_service.repository.ReservationRepository;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ReservationWorkflowTests {
    final ReservationRepository repository = mock(ReservationRepository.class);
    final PlaceCommandService commands = mock(PlaceCommandService.class);
    final ParkingGateway gateway = mock(ParkingGateway.class);
    final Clock clock = Clock.fixed(Instant.parse("2026-11-07T10:00:00Z"), ZoneOffset.UTC);
    final MockEnvironment environment = new MockEnvironment();
    final ReservationService service = new ReservationService(repository, commands, gateway, clock, environment);
    final UUID key = UUID.randomUUID();
    final OffsetDateTime now = OffsetDateTime.now(clock);
    final ReservationCreateRequest request = new ReservationCreateRequest(20L, now.plusHours(1), now.plusHours(2), "VOITURE");

    @BeforeEach void setup() {
        when(gateway.place(20L)).thenReturn(new ParkingGateway.Place("20", true, false));
        when(gateway.estimate(any())).thenReturn(new ParkingGateway.Quote(new BigDecimal("15.00"), "MAD", "estimate-1"));
        when(gateway.finalAmount(any())).thenReturn(new ParkingGateway.Quote(new BigDecimal("12.50"), "MAD", "final-1"));
        when(repository.saveAndFlush(any())).thenAnswer(invocation -> {
            Reservation reservation = invocation.getArgument(0); reservation.setId(1L); return reservation;
        });
    }
    Reservation reservation(ReservationStatus status) {
        Reservation reservation = new Reservation();
        reservation.setId(1L); reservation.setConducteurId(42L); reservation.setPlaceId(20L);
        reservation.setDebutPrevu(now.plusHours(1)); reservation.setFinPrevue(now.plusHours(2));
        reservation.setTypeVehicule("VOITURE"); reservation.setCurrency("MAD");
        reservation.setStatut(status); reservation.setQuoteReference("estimate-1");
        when(repository.lockById(1L)).thenReturn(Optional.of(reservation));
        when(repository.findPlaceId(1L)).thenReturn(Optional.of(20L));
        return reservation;
    }
    @Test void createsWithServerIdentityAndBookingPayment() {
        var response = service.create(42L, request, key);
        assertEquals("42", response.conducteurId()); assertEquals("CONFIRMED", response.statut().name());
        assertEquals("PAID", response.paymentStatus()); assertTrue(response.paymentReference().startsWith("SIM-"));
        assertEquals(new BigDecimal("15.00"), response.bookingPaid());
        assertEquals(new BigDecimal("15.00"), response.montantEstime());
        var order = inOrder(commands, repository);
        order.verify(commands).lockPlace(20L);
        order.verify(repository).findByConducteurIdAndRequestKey(42L, key);
        order.verify(repository).countOverlaps(eq(20L), any(), any(), anyList());
    }
    @Test void occupiedNowDoesNotPreventBookingAFutureInterval() {
        when(gateway.place(20L)).thenReturn(new ParkingGateway.Place("20", true, true));
        assertNotNull(service.create(42L, request, key));
    }
    @Test void rejectsOverlappingBookingBeforeSaving() {
        when(repository.countOverlaps(eq(20L), any(), any(), anyList())).thenReturn(1L);
        assertEquals(HttpStatus.CONFLICT, assertThrows(ReservationFailure.class, () -> service.create(42L, request, key)).status());
        verify(repository, never()).saveAndFlush(any());
    }
    @Test void rejectsOutOfServicePlace() {
        when(gateway.place(20L)).thenReturn(new ParkingGateway.Place("20", false, false));
        assertThrows(ReservationFailure.class, () -> service.create(42L, request, key));
        verify(gateway, never()).estimate(any());
    }
    @Test void replayReturnsSameReservationWithoutRepricing() {
        service.create(42L, request, key);
        var capture = ArgumentCaptor.forClass(Reservation.class);
        verify(repository).saveAndFlush(capture.capture());
        when(repository.findByConducteurIdAndRequestKey(42L, key)).thenReturn(Optional.of(capture.getValue()));
        clearInvocations(gateway);
        assertEquals("1", service.create(42L, request, key).id());
        verifyNoInteractions(gateway);
    }
    @Test void rejectsReusedKeyWithDifferentRequest() {
        Reservation existing = reservation(ReservationStatus.CONFIRMED);
        existing.setRequestFingerprint("different");
        when(repository.findByConducteurIdAndRequestKey(42L, key)).thenReturn(Optional.of(existing));
        assertThrows(ReservationFailure.class, () -> service.create(42L, request, key));
    }
    @Test void rejectsPastStart() {
        var past = new ReservationCreateRequest(20L, now.minusMinutes(1), now.plusHours(1), "VOITURE");
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ReservationFailure.class, () -> service.create(42L, past, key)).status());
    }
    @Test void rejectsInvalidPartnerPrices() {
        for (BigDecimal amount : List.of(new BigDecimal("-1"), new BigDecimal("1.234"), new BigDecimal("100000000.00"))) {
            when(gateway.estimate(any())).thenReturn(new ParkingGateway.Quote(amount, "MAD", "ref"));
            assertEquals(HttpStatus.BAD_GATEWAY, assertThrows(ReservationFailure.class, () -> service.create(42L, request, key)).status());
        }
    }
    @Test void cancelsOnlyOwnFutureReservation() {
        Reservation reservation = reservation(ReservationStatus.CONFIRMED);
        assertEquals(ReservationStatus.CANCELLED, service.cancel(42L, 1L).statut());
        assertEquals(ReservationStatus.CANCELLED, reservation.getStatut());
        verifyNoInteractions(gateway, commands);
    }
    @Test void concealsAnotherDriversReservation() {
        reservation(ReservationStatus.CONFIRMED);
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ReservationFailure.class, () -> service.cancel(999L, 1L)).status());
    }
    @Test void refusesCancellationAtPlannedStart() {
        reservation(ReservationStatus.CONFIRMED).setDebutPrevu(now);
        assertThrows(ReservationFailure.class, () -> service.cancel(42L, 1L));
    }
    @Test void repeatedCancellationIsHarmless() {
        reservation(ReservationStatus.CANCELLED);
        assertEquals(ReservationStatus.CANCELLED, service.cancel(42L, 1L).statut());
    }
    @Test void arrivalRecordsServerTimeAndDurablePlaceUpdate() {
        Reservation reservation = reservation(ReservationStatus.CONFIRMED);
        reservation.setDebutPrevu(now.minusMinutes(1));
        var response = service.arrive(1L);
        assertEquals(now, response.arriveeReelle()); assertTrue(response.placesSyncPending());
        assertEquals(ReservationStatus.IN_PROGRESS, response.statut());
        verify(commands).enqueue(1L, 20L, "OCCUPY");
    }
    @Test void rejectsArrivalBeforeTheSlot() {
        reservation(ReservationStatus.CONFIRMED);
        assertThrows(ReservationFailure.class, () -> service.arrive(1L));
    }
    @Test void physicalOccupancyBlocksArrivalEvenAfterAnotherPlannedEnd() {
        Reservation reservation = reservation(ReservationStatus.CONFIRMED);
        reservation.setDebutPrevu(now.minusMinutes(1));
        when(repository.existsByPlaceIdAndStatut(20L, ReservationStatus.IN_PROGRESS)).thenReturn(true);
        assertThrows(ReservationFailure.class, () -> service.arrive(1L));
        verify(commands, never()).enqueue(anyLong(), anyLong(), anyString());
    }
    @Test void departureUsesActualDurationWithoutSurchargeAndSimulatesPayment() {
        Reservation reservation = reservation(ReservationStatus.IN_PROGRESS);
        reservation.setArriveeReelle(now.minusMinutes(40));
        var response = service.depart(1L);
        var capture = ArgumentCaptor.forClass(ParkingGateway.PriceRequest.class);
        verify(gateway).finalAmount(capture.capture());
        assertEquals(now.minusMinutes(40), capture.getValue().arriveeReelle());
        assertEquals(now, capture.getValue().departReel());
        assertFalse(capture.getValue().overstayPenalty());
        assertEquals("PAID", response.paymentStatus());
        assertTrue(response.paymentReference().startsWith("SIM-"));
        verify(commands).enqueue(1L, 20L, "RELEASE");
    }
    @Test void repeatedDepartureDoesNotChargeOrReleaseTwice() {
        Reservation reservation = reservation(ReservationStatus.COMPLETED);
        reservation.setPaymentReference("SIM-existing");
        assertEquals("SIM-existing", service.depart(1L).paymentReference());
        verifyNoInteractions(gateway, commands);
    }
    @Test void departureRefusesPricingOutageWithoutCompleting() {
        Reservation reservation = reservation(ReservationStatus.IN_PROGRESS);
        reservation.setArriveeReelle(now.minusMinutes(10));
        when(gateway.finalAmount(any())).thenThrow(new ReservationFailure(HttpStatus.SERVICE_UNAVAILABLE, "UPSTREAM_UNAVAILABLE", "Unavailable"));
        assertThrows(ReservationFailure.class, () -> service.depart(1L));
        assertEquals(ReservationStatus.IN_PROGRESS, reservation.getStatut());
        assertNull(reservation.getDepartReel()); verifyNoInteractions(commands);
    }
    @Test void noShowsRemainDisabledWithoutAnAgreedGracePeriod() {
        assertEquals(0, service.expireNoShows()); verifyNoInteractions(repository);
    }
    @Test void noShowExpiryNeverReleasesAnOccupiedPlace() {
        environment.setProperty("parking.no-show-grace", "PT15M");
        Reservation reservation = reservation(ReservationStatus.IN_PROGRESS);
        reservation.setDebutPrevu(now.minusMinutes(30)); reservation.setArriveeReelle(now.minusMinutes(29));
        when(repository.findNoShowIds(any(), any())).thenReturn(List.of(1L));
        assertEquals(0, service.expireNoShows());
        assertEquals(ReservationStatus.IN_PROGRESS, reservation.getStatut()); verifyNoInteractions(commands);
    }
    @Test void paidSlotIsNeverExpiredEvenWithOldGraceConfiguration() {
        environment.setProperty("parking.no-show-grace", "PT15M");
        Reservation reservation = reservation(ReservationStatus.CONFIRMED);
        reservation.setDebutPrevu(now.minusMinutes(16));
        when(repository.findNoShowIds(any(), any())).thenReturn(List.of(1L));
        assertEquals(0, service.expireNoShows()); assertEquals(ReservationStatus.CONFIRMED, reservation.getStatut());
        verifyNoInteractions(commands);
    }

    Reservation prepaid() {
        Reservation value = reservation(ReservationStatus.IN_PROGRESS);
        value.setDebutPrevu(now.minusHours(2)); value.setFinPrevue(now.plusMinutes(1));
        value.setArriveeReelle(now.minusMinutes(20)); value.setBookingPaid(new BigDecimal("15.00"));
        value.setPaymentStatus("PAID"); value.setPaymentReference("SIM-booking");
        return value;
    }
    @Test void earlyDepartureKeepsFullBookingPaymentWithoutCallingTariffs() {
        prepaid(); var response = service.depart(1L);
        assertEquals(new BigDecimal("15.00"), response.montantFinal());
        assertEquals(new BigDecimal("0.00"), response.extraPaid());
        assertEquals("SIM-booking", response.paymentReference());
        assertNull(response.extraPaymentReference()); verifyNoInteractions(gateway);
    }
    @Test void departureExactlyAtPaidEndNeedsNoExtraPayment() {
        prepaid().setFinPrevue(now);
        assertEquals(new BigDecimal("0.00"), service.depart(1L).extraPaid());
        verifyNoInteractions(gateway);
    }
    @Test void overstayBillsOnlyTimeAfterPaidEndAndReplayDoesNotChargeAgain() {
        prepaid().setFinPrevue(now.minusMinutes(10));
        var response = service.depart(1L);
        var capture = ArgumentCaptor.forClass(ParkingGateway.PriceRequest.class);
        verify(gateway).finalAmount(capture.capture());
        assertEquals(now.minusMinutes(10), capture.getValue().arriveeReelle());
        assertEquals(now.minusMinutes(10), capture.getValue().debutPrevu());
        assertEquals(now, capture.getValue().departReel()); assertNull(capture.getValue().quoteReference());
        assertFalse(capture.getValue().overstayPenalty());
        assertEquals(new BigDecimal("27.50"), response.montantFinal());
        assertEquals(new BigDecimal("12.50"), response.extraPaid());
        assertEquals("SIM-booking", response.paymentReference());
        assertTrue(response.extraPaymentReference().startsWith("SIM-"));
        clearInvocations(gateway, commands);
        assertEquals(response.extraPaymentReference(), service.depart(1L).extraPaymentReference());
        verifyNoInteractions(gateway, commands);
    }
    @Test void cancellationKeepsBookingPaymentWithoutRefund() {
        Reservation value = prepaid(); value.setStatut(ReservationStatus.CONFIRMED);
        value.setDebutPrevu(now.plusHours(1));
        var response = service.cancel(42L, 1L);
        assertEquals(new BigDecimal("15.00"), response.bookingPaid());
        assertEquals("PAID", response.paymentStatus()); assertEquals("SIM-booking", response.paymentReference());
        verifyNoInteractions(gateway);
    }
    @Test void lateArrivalKeepsPaidSlotDespiteOldGraceSetting() {
        Reservation value = prepaid(); value.setStatut(ReservationStatus.CONFIRMED); value.setArriveeReelle(null);
        environment.setProperty("parking.no-show-grace", "PT15M");
        assertEquals(now, service.arrive(1L).arriveeReelle());
    }
    @Test void arrivalAtOrAfterSlotEndIsRefused() {
        Reservation value = prepaid(); value.setStatut(ReservationStatus.CONFIRMED); value.setFinPrevue(now);
        assertThrows(ReservationFailure.class, () -> service.arrive(1L));
    }
    @Test void overstayCurrencyMismatchKeepsBookingPaymentAndActiveStay() {
        Reservation value = prepaid(); value.setFinPrevue(now.minusMinutes(1));
        when(gateway.finalAmount(any())).thenReturn(new ParkingGateway.Quote(new BigDecimal("5.00"), "EUR", "bad"));
        assertThrows(ReservationFailure.class, () -> service.depart(1L));
        assertEquals(ReservationStatus.IN_PROGRESS, value.getStatut()); assertNull(value.getExtraPaid());
        assertEquals("SIM-booking", value.getPaymentReference()); verifyNoInteractions(commands);
    }
}
