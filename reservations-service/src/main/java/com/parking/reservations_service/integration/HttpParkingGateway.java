package com.parking.reservations_service.integration;
import com.parking.reservations_service.service.ReservationFailure;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;
import java.util.function.Supplier;
import java.util.concurrent.ConcurrentHashMap;
@Component
public class HttpParkingGateway implements ParkingGateway {
    private final Environment environment;
    private final Map<String, RestClient> clients = new ConcurrentHashMap<>();
    public HttpParkingGateway(Environment environment) { this.environment = environment; }
    private RestClient client(String service) {
        return clients.computeIfAbsent(service, this::createClient);
    }
    private RestClient createClient(String service) {
        String base = environment.getProperty("parking." + service + ".url", "");
        String user = environment.getProperty("parking." + service + ".user", "");
        String password = environment.getProperty("parking." + service + ".password", "");
        if (base.isBlank() || user.isBlank() || password.isBlank()) {
            throw new ReservationFailure(HttpStatus.SERVICE_UNAVAILABLE, "INTEGRATION_NOT_CONFIGURED", "Service " + service + " non configuré");
        }
        URI uri;
        try { uri = URI.create(base); }
        catch (IllegalArgumentException exception) {
            throw new ReservationFailure(HttpStatus.SERVICE_UNAVAILABLE, "INTEGRATION_NOT_CONFIGURED", "URL de service invalide");
        }
        if (uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
            || !("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
            throw new ReservationFailure(HttpStatus.SERVICE_UNAVAILABLE, "INTEGRATION_NOT_CONFIGURED", "URL de service invalide");
        }
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build());
        factory.setReadTimeout(Duration.ofSeconds(3));
        return RestClient.builder().baseUrl(base).requestFactory(factory)
            .defaultHeaders(headers -> headers.setBasicAuth(user, password)).build();
    }
    private <T> T call(Supplier<T> action) {
        try { return action.get(); }
        catch (RestClientResponseException exception) {
            if (exception.getStatusCode().value() == 404) { throw new ReservationFailure(HttpStatus.BAD_GATEWAY, "UPSTREAM_NOT_FOUND", "Ressource partenaire introuvable"); }
            if (exception.getStatusCode().value() == 409) { throw ReservationFailure.conflict("Place indisponible"); }
            throw new ReservationFailure(HttpStatus.BAD_GATEWAY, "UPSTREAM_ERROR", "Un service partenaire a refusé la demande");
        } catch (RestClientException exception) {
            throw new ReservationFailure(HttpStatus.SERVICE_UNAVAILABLE, "UPSTREAM_UNAVAILABLE", "Service partenaire indisponible");
        }
    }
    public Place place(long id) {
        Place result = call(() -> client("places").get().uri("/internal/places/{id}", id).retrieve().body(Place.class));
        if (result == null || !Long.toString(id).equals(result.id()) || result.enService() == null || result.occupee() == null) {
            throw new ReservationFailure(HttpStatus.BAD_GATEWAY, "INVALID_PARTNER_RESPONSE", "Réponse Places invalide");
        }
        return result;
    }
    public Quote estimate(PriceRequest request) { return call(() -> client("tarifs").post().uri("/internal/tarifs/estimate").body(request).retrieve().body(Quote.class)); }
    public Quote finalAmount(PriceRequest request) { return call(() -> client("tarifs").post().uri("/internal/tarifs/final").body(request).retrieve().body(Quote.class)); }
    public void changeOccupancy(long placeId, long reservationId, String operation, String key) {
        call(() -> { client("places").post().uri("/internal/places/{id}/" + ("OCCUPY".equals(operation) ? "occupy" : "release"), placeId)
            .header("Idempotency-Key", key).body(Map.of("reservationId", Long.toString(reservationId))).retrieve().toBodilessEntity(); return null; });
    }
}
