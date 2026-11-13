package com.parking.tarifs.security;

import com.parking.tarifs.exception.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;

import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Client HTTP qui interroge POST /internal/auth/validate-user-request de Réservations.
 * <p>
 * Envoie en Basic le compte machine Tarifs (AUTH_TARIFS_USER / AUTH_TARIFS_SECRET).
 * Retourne un {@link UtilisateurValide} si la session est valide.
 * <p>
 * Comportement fail-closed : toute indisponibilité = 503 chez Tarifs.
 */
@Component
public class AuthValidationClient {

    /**
     * Représente un utilisateur dont la session a été validée par Réservations.
     */
    public record UtilisateurValide(String userId, String displayName, List<String> roles, Instant authenticatedAt) {
        /** Vérifie que l'utilisateur possède le rôle indiqué (ex. "ADMIN"). */
        public boolean hasRole(String role) {
            return roles != null && roles.contains(role);
        }
    }

    // Corps JSON attendu par /internal/auth/validate-user-request
    private record ValidationRequest(String sessionCookie, String httpMethod, String csrfToken) {}

    // Réponse JSON retournée : { "user": { "userId", "displayName", "roles" }, "authenticatedAt" }
    private record ValidationResponse(UserPayload user, Instant authenticatedAt) {}
    private record UserPayload(String userId, String displayName, List<String> roles) {}

    private final RestClient restClient;

    public AuthValidationClient(
            @Value("${tarifs.auth.service.url:}") String authServiceUrl,
            @Value("${tarifs.auth.tarifs.user:}") String authUser,
            @Value("${tarifs.auth.tarifs.secret:}") String authSecret) {

        if (authServiceUrl.isBlank() || authUser.isBlank() || authSecret.isBlank()) {
            // Service non configuré → fail-closed : toute validation échouera
            this.restClient = null;
            return;
        }

        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build());
        factory.setReadTimeout(Duration.ofSeconds(2));

        this.restClient = RestClient.builder()
                .baseUrl(authServiceUrl)
                .requestFactory(factory)
                .defaultHeaders(h -> h.setBasicAuth(authUser, authSecret))
                .build();
    }

    /**
     * Valide une requête utilisateur.
     *
     * @param sessionCookie valeur du cookie PARKING_SESSION (sans le nom)
     * @param httpMethod    méthode HTTP de la requête originale (GET, PUT…)
     * @param csrfToken     valeur de X-CSRF-TOKEN (null autorisé pour GET)
     * @return utilisateur validé
     * @throws AuthenticationRequiredException si la session est invalide (401)
     * @throws AccesDeniedAuthentifiedException si le CSRF est invalide (403)
     * @throws ServiceIndisponibleException     si le service auth est inaccessible ou non configuré
     */
    public UtilisateurValide valider(String sessionCookie, String httpMethod, String csrfToken) {
        if (restClient == null) {
            throw new ServiceIndisponibleException(
                    "Le service d'authentification n'est pas configuré (AUTH_SERVICE_URL manquant)");
        }

        ValidationRequest corps = new ValidationRequest(sessionCookie, httpMethod, csrfToken);

        try {
            ValidationResponse reponse = restClient.post()
                    .uri("/internal/auth/validate-user-request")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(corps)
                    .retrieve()
                    .body(ValidationResponse.class);

            if (reponse == null || reponse.user() == null) {
                throw new ServiceIndisponibleException(
                        "Réponse inattendue du service d'authentification");
            }

            UserPayload u = reponse.user();
            return new UtilisateurValide(u.userId(), u.displayName(), u.roles(), reponse.authenticatedAt());

        } catch (RestClientResponseException ex) {
            int status = ex.getStatusCode().value();
            if (status == 401) {
                // 401 INVALID_SERVICE_CREDENTIALS (notre compte machine invalide) → Tarifs = 503 fail-closed
                // 401 AUTHENTICATION_REQUIRED (session invalide) → Tarifs = 401
                String body = ex.getMessage() != null ? ex.getMessage() : "";
                if (body.contains("INVALID_SERVICE_CREDENTIALS")) {
                    throw new ServiceIndisponibleException(
                            "Identifiants machine Tarifs refusés par le service d'authentification");
                }
                throw new AuthenticationRequiredException(
                        "Session absente, expirée ou révoquée");
            }
            if (status == 403) {
                // 403 CSRF_INVALID ou 403 SERVICE_FORBIDDEN (compte machine interdit) → 503 ou 403
                String body = ex.getMessage() != null ? ex.getMessage() : "";
                if (body.contains("SERVICE_FORBIDDEN")) {
                    throw new ServiceIndisponibleException(
                            "Compte machine Tarifs interdit par le service d'authentification");
                }
                throw new AccesDeniedAuthentifiedException("CSRF_INVALID", "Jeton CSRF absent ou invalide");
            }
            throw new ServiceIndisponibleException(
                    "Réponse inattendue du service d'authentification : " + status);

        } catch (RestClientException ex) {
            throw new ServiceIndisponibleException(
                    "Service d'authentification inaccessible", ex);
        }
    }
}
