package com.parking.reservations_service.service;

import com.parking.reservations_service.dto.ReservationCreateRequest;
import com.parking.reservations_service.integration.ParkingGateway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Run only against the disposable database created by scripts/Test-Reservations.ps1. */
@SpringBootTest(properties = {"parking.sync.enabled=false", "parking.no-show-grace="})
@EnabledIfEnvironmentVariable(named = "PARKING_INTEGRATION", matches = "true")
class ReservationPostgresTests {
    @Autowired ReservationService service;
    @Autowired PlaceCommandService commands;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean ParkingGateway gateway;
    long place;

    @BeforeEach void setup() {
        // Unique test-owned place IDs; never delete another test's or user's data.
        place = Math.abs(UUID.randomUUID().getMostSignificantBits() / 2) + 1;
        when(gateway.place(anyLong())).thenAnswer(call -> new ParkingGateway.Place(call.getArgument(0).toString(), true, false));
        when(gateway.estimate(any())).thenReturn(new ParkingGateway.Quote(new BigDecimal("15.00"), "MAD", "test-estimate"));
        when(gateway.finalAmount(any())).thenReturn(new ParkingGateway.Quote(new BigDecimal("12.00"), "MAD", "test-final"));
    }
    ReservationCreateRequest request(OffsetDateTime start, OffsetDateTime end) {
        return new ReservationCreateRequest(place, start, end, "VOITURE");
    }
    @Test void concurrentOverlappingBookingsHaveExactlyOneWinner() throws Exception {
        var start = OffsetDateTime.now().plusHours(2);
        var request = request(start, start.plusHours(1));
        var gate = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> attempt = () -> { gate.await(); try {
                service.create(42L, request, UUID.randomUUID()); return true;
            } catch (ReservationFailure failure) { assertEquals(409, failure.status().value()); return false; } };
            var first = executor.submit(attempt); var second = executor.submit(attempt); gate.countDown();
            assertNotEquals(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS));
        }
        assertEquals(1, jdbc.queryForObject("select count(*) from reservations where place_id = ?", Integer.class, place));
    }
    @Test void adjacentIntervalsAreAllowedAndIdempotencySurvivesTransactions() {
        var start = OffsetDateTime.now().plusHours(2);
        var key = UUID.randomUUID(); var request = request(start, start.plusHours(1));
        var first = service.create(42L, request, key);
        assertEquals(first.id(), service.create(42L, request, key).id());
        assertNotEquals(first.id(), service.create(42L, request(start.plusHours(1), start.plusHours(2)), UUID.randomUUID()).id());
        assertEquals(2, jdbc.queryForObject("select count(*) from reservations where place_id = ?", Integer.class, place));
    }
    @Test void cancellationPersistsAndReleasesOnlyThePlannedSlot() {
        var start = OffsetDateTime.now().plusHours(2); var request = request(start, start.plusHours(1));
        var first = service.create(42L, request, UUID.randomUUID());
        service.cancel(42L, Long.parseLong(first.id()));
        assertEquals("CANCELLED", service.mineById(42L, Long.parseLong(first.id())).statut().name());
        assertNotNull(service.create(43L, request, UUID.randomUUID()));
        assertEquals(0, jdbc.queryForObject("select count(*) from reservation_place_commands where place_id = ?", Integer.class, place));
    }
    @Test void arrivalAndDeparturePersistOrderedRetryableCommandsWithoutDoublePayment() {
        var start = OffsetDateTime.now().plusHours(2);
        long id = Long.parseLong(service.create(42L, request(start, start.plusHours(1)), UUID.randomUUID()).id());
        jdbc.update("update reservations set debut_prevu = current_timestamp - interval '10 minutes', fin_prevue = current_timestamp + interval '1 hour' where id = ?", id);
        assertTrue(service.arrive(id).placesSyncPending());
        var completed = service.depart(id);
        assertEquals("PAID", completed.paymentStatus());
        assertEquals(completed.paymentReference(), service.depart(id).paymentReference());
        verify(gateway, times(1)).finalAmount(any());
        doThrow(new ReservationFailure(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "TEST_OUTAGE", "test"))
            .when(gateway).changeOccupancy(place, id, "OCCUPY", "reservation/" + id + "/OCCUPY");
        commands.dispatchBatch();
        assertTrue(service.mineById(42L, id).placesSyncPending());
        verify(gateway, never()).changeOccupancy(place, id, "RELEASE", "reservation/" + id + "/RELEASE");
        doNothing().when(gateway).changeOccupancy(anyLong(), anyLong(), anyString(), anyString());
        jdbc.update("update reservation_place_commands set next_attempt = current_timestamp - interval '1 second' where reservation_id = ?", id);
        commands.dispatchBatch();
        assertFalse(service.mineById(42L, id).placesSyncPending());
        var order = inOrder(gateway);
        order.verify(gateway, atLeastOnce()).changeOccupancy(place, id, "OCCUPY", "reservation/" + id + "/OCCUPY");
        order.verify(gateway).changeOccupancy(place, id, "RELEASE", "reservation/" + id + "/RELEASE");
        assertEquals(2, jdbc.queryForObject("select count(*) from reservation_place_commands where reservation_id = ? and completed", Integer.class, id));
    }
    @Test void pricingFailureRollsBackDepartureAndReleaseCommand() {
        var start = OffsetDateTime.now().plusHours(2);
        long id = Long.parseLong(service.create(42L, request(start, start.plusHours(1)), UUID.randomUUID()).id());
        jdbc.update("update reservations set debut_prevu = current_timestamp - interval '10 minutes', fin_prevue = current_timestamp + interval '1 hour' where id = ?", id);
        service.arrive(id);
        when(gateway.finalAmount(any())).thenThrow(new ReservationFailure(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "TEST_OUTAGE", "test"));
        assertThrows(ReservationFailure.class, () -> service.depart(id));
        var unchanged = service.mineById(42L, id);
        assertEquals("IN_PROGRESS", unchanged.statut().name()); assertNull(unchanged.departReel());
        assertEquals(0, jdbc.queryForObject("select count(*) from reservation_place_commands where reservation_id = ? and operation = 'RELEASE'", Integer.class, id));
        commands.dispatchBatch();
    }
}
