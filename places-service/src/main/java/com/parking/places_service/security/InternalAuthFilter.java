package com.parking.places_service.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * Protège /internal/** : seul le service Réservations (HTTP Basic) peut
 * appeler.
 */
@Component
public class InternalAuthFilter extends OncePerRequestFilter {

    private final String user;
    private final String password;

    public InternalAuthFilter(@Value("${places.internal.user:}") String user,
            @Value("${places.internal.password:}") String password) {
        this.user = user;
        this.password = password;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/internal/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        if (user.isBlank() || password.isBlank()) {
            reject(response, 503, "SERVICE_NOT_CONFIGURED", "Authentification interne non configurée");
            return;
        }
        if (!isValid(request.getHeader("Authorization"))) {
            reject(response, 401, "SERVICE_AUTHENTICATION_FAILED", "Identifiants du service invalides");
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isValid(String header) {
        if (header == null || !header.startsWith("Basic ")) {
            return false;
        }
        String decoded;
        try {
            decoded = new String(Base64.getDecoder().decode(header.substring(6).trim()),
                    StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return false;
        }
        String expected = user + ":" + password;
        // comparaison en temps constant
        return MessageDigest.isEqual(decoded.getBytes(StandardCharsets.UTF_8),
                expected.getBytes(StandardCharsets.UTF_8));
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