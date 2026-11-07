package com.parking.reservations_service.service;
import com.parking.reservations_service.integration.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.springframework.mock.env.MockEnvironment;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;

class ParkingGatewayHttpTests {
    HttpServer server;
    MockEnvironment environment;
    HttpParkingGateway gateway;
    final AtomicReference<String> path = new AtomicReference<>();
    final AtomicReference<String> auth = new AtomicReference<>();
    final AtomicReference<String> body = new AtomicReference<>();
    final AtomicReference<String> key = new AtomicReference<>();
    int status = 200;
    String response = "{\"id\":\"20\",\"enService\":true,\"occupee\":false}";
    @BeforeEach void setup() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            path.set(exchange.getRequestURI().getPath()); auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            key.set(exchange.getRequestHeaders().getFirst("Idempotency-Key"));
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] content = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, content.length); exchange.getResponseBody().write(content); exchange.close();
        }); server.start();
        environment = new MockEnvironment().withProperty("parking.places.url", "http://127.0.0.1:" + server.getAddress().getPort())
            .withProperty("parking.places.user", "test-reservations").withProperty("parking.places.password", "synthetic-only");
        gateway = new HttpParkingGateway(environment);
    }
    @AfterEach void stop() { server.stop(0); }
    @Test void readsThePlaceAndAuthenticatesAsAMachine() {
        assertTrue(gateway.place(20L).enService()); assertEquals("/internal/places/20", path.get());
        assertEquals("Basic " + Base64.getEncoder().encodeToString("test-reservations:synthetic-only".getBytes(StandardCharsets.UTF_8)), auth.get());
    }
    @Test void occupancyCommandCarriesItsStableKeyAndReservationOwner() {
        response = "{}"; gateway.changeOccupancy(20L, 1L, "OCCUPY", "reservation/1/OCCUPY");
        assertEquals("/internal/places/20/occupy", path.get()); assertEquals("reservation/1/OCCUPY", key.get());
        assertEquals("{\"reservationId\":\"1\"}", body.get());
    }
    @Test void rejectsAMismatchedPartnerIdentity() {
        response = "{\"id\":\"99\",\"enService\":true,\"occupee\":false}";
        assertEquals(502, assertThrows(ReservationFailure.class, () -> gateway.place(20L)).status().value());
    }
    @Test void missingOccupancyIsNotTreatedAsAFreePlace() {
        response = "{\"id\":\"20\",\"enService\":true}";
        assertEquals(502, assertThrows(ReservationFailure.class, () -> gateway.place(20L)).status().value());
    }
    @Test void partnerConflictIsControlledAndDoesNotExposeItsBody() {
        status = 409; response = "private partner diagnostic";
        var failure = assertThrows(ReservationFailure.class, () -> gateway.place(20L));
        assertEquals(409, failure.status().value()); assertFalse(failure.getMessage().contains("diagnostic"));
    }
    @Test void missingOrMalformedConfigurationFailsClosed() {
        assertEquals(503, assertThrows(ReservationFailure.class, () -> new HttpParkingGateway(new MockEnvironment()).place(20L)).status().value());
        environment.setProperty("parking.places.url", "not a URI");
        assertEquals(503, assertThrows(ReservationFailure.class, () -> gateway.place(20L)).status().value());
    }
}
