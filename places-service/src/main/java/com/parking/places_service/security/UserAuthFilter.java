package com.parking.places_service.security;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Set;

/**
 * Protège /api/** : demande au service d'authentification (Réservations) si la
 * session
 * est valide. Lecture : tout utilisateur connecté. Modification : rôle ADMIN.
 */
@Component
public class UserAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(UserAuthFilter.class);
    private static final String COOKIE_NAME = "PARKING_SESSION";
    private static final Set<String> READ_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    public record AuthRequest(String sessionCookie, String httpMethod, String csrfToken) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AuthUser(String userId, String displayName, List<String> roles) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AuthResult(AuthUser user) {
    }

    private final boolean enabled;
    private final RestClient client; // null si non configuré

    public UserAuthFilter(@Value("${places.auth.enabled:true}") boolean enabled,
            @Value("${places.auth.url:}") String url,
            @Value("${places.auth.user:}") String user,
            @Value("${places.auth.password:}") String password) {
        this.enabled = enabled;
        if (!enabled) {
            log.warn("AUTHENTIFICATION DES ROUTES /api DÉSACTIVÉE (développement uniquement)");
        }
        if (!url.isBlank() && !user.isBlank() && !password.isBlank()) {
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
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
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
            log.error("Service d'authentification injoignable");
            reject(response, 503, "AUTHENTICATION_UNAVAILABLE", "Authentification indisponible");
            return;
        }
        if (result == null || result.user() == null || result.user().roles() == null) {
            reject(response, 503, "AUTHENTICATION_UNAVAILABLE", "Réponse d'authentification invalide");
            return;
        }
        if (!READ_METHODS.contains(method) && !result.user().roles().contains("ADMIN")) {
            reject(response, 403, "FORBIDDEN", "Droits insuffisants");
            return;
        }
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

    private void reject(HttpServletResponse response, int status, String code, String message)
            throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}