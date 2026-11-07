package com.parking.reservations_service.service;

import com.parking.reservations_service.dto.ReservationCreateRequest;
import com.parking.reservations_service.entity.Reservation;
import com.parking.reservations_service.integration.ParkingGateway;
import com.parking.reservations_service.repository.ReservationRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.mock.env.MockEnvironment;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Tests métier isolés pour la Partie 4 : aucun serveur, réseau ou PostgreSQL. */
class ReservationQueriesTests {
    final ReservationRepository repository = mock(ReservationRepository.class);
    final PlaceCommandService commands = mock(PlaceCommandService.class);
    final ParkingGateway gateway = mock(ParkingGateway.class);
    final Clock clock = Clock.fixed(Instant.parse("2026-11-07T10:00:00Z"), ZoneOffset.UTC);
    final ReservationService service = new ReservationService(repository, commands, gateway, clock, new MockEnvironment());
    final OffsetDateTime now = OffsetDateTime.now(clock);
    final ReservationCreateRequest request = new ReservationCreateRequest(20L, now.plusHours(1), now.plusHours(2), "voiture");

    Reservation reservation() {
        var entity = new Reservation();
        entity.setId(1L); entity.setConducteurId(42L); entity.setPlaceId(20L);
        entity.setDebutPrevu(request.debutPrevu()); entity.setFinPrevue(request.finPrevue());
        return entity;
    }

    @Test void mineKeepsDriverScopeAndPageInformation() {
        when(repository.findByConducteurId(eq(42L), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(reservation()), PageRequest.of(0, 20), 1));
        var response = service.mine(42L, 0, 20);
        assertEquals("42", response.items().getFirst().conducteurId());
        assertEquals(1, response.total()); assertEquals(0, response.page()); assertEquals(20, response.size());
        var page = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findByConducteurId(eq(42L), page.capture());
        assertEquals(20, page.getValue().getPageSize());
    }

    @Test void mineRejectsInvalidPaginationBeforeQuerying() {
        for (int[] paging : List.of(new int[]{-1, 20}, new int[]{0, 0}, new int[]{0, 101})) {
            var failure = assertThrows(ReservationFailure.class, () -> service.mine(42L, paging[0], paging[1]));
            assertEquals(HttpStatus.BAD_REQUEST, failure.status());
        }
        verifyNoInteractions(repository);
    }

    @Test void mineByIdReturnsTheOwnersReservation() {
        when(repository.findByIdAndConducteurId(1L, 42L)).thenReturn(Optional.of(reservation()));
        assertEquals("1", service.mineById(42L, 1L).id());
        verify(repository).findByIdAndConducteurId(1L, 42L);
    }

    @Test void mineByIdConcealsAReservationOutsideTheOwnerScope() {
        when(repository.findByIdAndConducteurId(1L, 99L)).thenReturn(Optional.empty());
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ReservationFailure.class, () -> service.mineById(99L, 1L)).status());
        verify(repository).findByIdAndConducteurId(1L, 99L);
    }

    @Test void operationsAcceptsExactlyThirtyOneDays() {
        when(repository.findOperations(eq(now), eq(now.plusDays(31)), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));
        assertTrue(service.operations(now, now.plusDays(31), 0, 20).items().isEmpty());
    }

    @Test void operationsRejectsMoreThanThirtyOneDaysBeforeQuerying() {
        var failure = assertThrows(ReservationFailure.class, () -> service.operations(now, now.plusDays(31).plusSeconds(1), 0, 20));
        assertEquals(HttpStatus.BAD_REQUEST, failure.status()); verifyNoInteractions(repository);
    }

    @Test void availabilityDistinguishesCurrentOccupancyFromFutureBookings() {
        when(gateway.place(20L)).thenReturn(new ParkingGateway.Place("20", true, true));
        assertTrue(service.availability(20L, request.debutPrevu(), request.finPrevue()).get("available"));
        verify(repository).countOverlaps(eq(20L), eq(request.debutPrevu()), eq(request.finPrevue()), anyList());
    }

    @Test void availabilityRejectsAnOverlappingInterval() {
        when(gateway.place(20L)).thenReturn(new ParkingGateway.Place("20", true, false));
        when(repository.countOverlaps(eq(20L), any(), any(), anyList())).thenReturn(1L);
        assertFalse(service.availability(20L, request.debutPrevu(), request.finPrevue()).get("available"));
    }

    @Test void availabilityRejectsAnOutOfServicePlace() {
        when(gateway.place(20L)).thenReturn(new ParkingGateway.Place("20", false, false));
        assertFalse(service.availability(20L, request.debutPrevu(), request.finPrevue()).get("available"));
    }

    @Test void availabilityRejectsAnEmptyIntervalWithoutCallingPartners() {
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ReservationFailure.class, () -> service.availability(20L, now, now)).status());
        verifyNoInteractions(gateway, repository);
    }

    @Test void estimateUsesTheServerDriverAndPartnerQuoteWithoutSaving() {
        when(gateway.place(20L)).thenReturn(new ParkingGateway.Place("20", true, false));
        when(gateway.estimate(any())).thenReturn(new ParkingGateway.Quote(new BigDecimal("15"), "MAD", "test-quote"));
        var quote = service.estimate(42L, request);
        assertEquals(new BigDecimal("15.00"), quote.amount());
        var sent = ArgumentCaptor.forClass(ParkingGateway.PriceRequest.class);
        verify(gateway).estimate(sent.capture());
        assertEquals("42", sent.getValue().conducteurId()); assertEquals("VOITURE", sent.getValue().typeVehicule());
        assertNull(sent.getValue().arriveeReelle()); assertNull(sent.getValue().departReel());
        assertFalse(sent.getValue().overstayPenalty()); verifyNoInteractions(repository, commands);
    }

    @Test void estimateRejectsAStartExactlyAtTheCurrentTime() {
        var immediate = new ReservationCreateRequest(20L, now, now.plusHours(1), "VOITURE");
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ReservationFailure.class, () -> service.estimate(42L, immediate)).status());
        verifyNoInteractions(gateway, repository, commands);
    }

    @Test void estimateRejectsAQuoteWithMissingCurrency() {
        when(gateway.place(20L)).thenReturn(new ParkingGateway.Place("20", true, false));
        when(gateway.estimate(any())).thenReturn(new ParkingGateway.Quote(new BigDecimal("15.00"), null, "test-quote"));
        var failure = assertThrows(ReservationFailure.class, () -> service.estimate(42L, request));
        assertEquals(HttpStatus.BAD_GATEWAY, failure.status()); assertEquals("INVALID_PARTNER_RESPONSE", failure.code());
        verifyNoInteractions(repository, commands);
    }
}
