package com.parking.reservations_service.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;

@Component
public class ReservationUserAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ReservationUserAuthFilter.class);
    private static final String COOKIE_NAME = "PARKING_SESSION";

    public record AuthRequest(String sessionCookie, String httpMethod, String csrfToken) {}

    public record AuthUser(String userId, String displayName, List<String> roles) {}

    public record AuthResult(AuthUser user) {}

    private final boolean enabled;
    private final RestClient client;

    public ReservationUserAuthFilter(
            @Value("${reservations.auth.enabled:true}") boolean enabled,
            @Value("${reservations.auth.url:${AUTH_API_URL:http://auth:8083}}") String url,
            @Value("${reservations.auth.user:${AUTH_RESERVATIONS_USER:reservations}}") String user,
            @Value("${reservations.auth.password:${AUTH_RESERVATIONS_PASSWORD:ReservationsAuthSecret2026_xyz}}") String password) {
        this.enabled = enabled;
        if (!enabled) {
            log.warn("AUTHENTIFICATION DES ROUTES /api DÉSACTIVÉE");
            this.client = null;
        } else if (!url.isBlank() && !user.isBlank() && !password.isBlank()) {
            var factory = new JdkClientHttpRequestFactory(
                    HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build());
            factory.setReadTimeout(Duration.ofSeconds(2));
            this.client = RestClient.builder().baseUrl(url).requestFactory(factory)
                    .defaultHeaders(h -> h.setBasicAuth(user, password)).build();
        } else {
            this.client = null;
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return !uri.startsWith("/api/reservations");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!enabled) {
            chain.doFilter(request, response);
            return;
        }
        if (client == null) {
            reject(response, 503, "AUTHENTICATION_UNAVAILABLE", "Authentification non configurée");
            return;
        }
        String session = sessionCookie(request);
        if (session == null || !session.matches("[0-9a-fA-F-]{36}")) {
            reject(response, 401, "AUTHENTICATION_REQUIRED", "Authentification requise");
            return;
        }
        String method = request.getMethod();
        AuthResult result;
        try {
            result = client.post().uri("/internal/auth/validate-user-request")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new AuthRequest(session, method, request.getHeader("X-CSRF-TOKEN")))
                    .retrieve().body(AuthResult.class);
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            String body = e.getResponseBodyAsString();
            if (status == 403 && body.contains("CSRF_INVALID")) {
                reject(response, 403, "CSRF_INVALID", "Jeton CSRF absent ou invalide");
            } else if (status == 401 && body.contains("AUTHENTICATION_REQUIRED")) {
                reject(response, 401, "AUTHENTICATION_REQUIRED", "Authentification requise");
            } else {
                log.error("Validation de session impossible (statut {})", status);
                reject(response, 503, "AUTHENTICATION_UNAVAILABLE", "Authentification indisponible");
            }
            return;
        } catch (RestClientException e) {
            log.error("Service d'authentification injoignable", e);
            reject(response, 503, "AUTHENTICATION_UNAVAILABLE", "Authentification indisponible");
            return;
        }

        if (result == null || result.user() == null || result.user().roles() == null) {
            reject(response, 503, "AUTHENTICATION_UNAVAILABLE", "Réponse d'authentification invalide");
            return;
        }

        Long userId;
        try {
            userId = Long.valueOf(result.user().userId());
        } catch (NumberFormatException nfe) {
            reject(response, 503, "AUTHENTICATION_UNAVAILABLE", "Identifiant utilisateur invalide");
            return;
        }

        var principal = new ParkingUserPrincipal(userId, result.user().displayName(), result.user().roles());
        var authentication = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(authentication);

        chain.doFilter(request, response);
    }

    private String sessionCookie(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        for (Cookie cookie : request.getCookies()) {
            if (COOKIE_NAME.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private void reject(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}
