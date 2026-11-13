package com.parking.tarifs.security;

import tools.jackson.databind.ObjectMapper;
import com.parking.tarifs.dto.ErreurResponse;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * Filtre HTTP qui protège toutes les routes /internal/** par HTTP Basic.
 * <p>
 * Seul le compte machine Réservations (INTERNAL_CALLER_USER / INTERNAL_CALLER_SECRET)
 * est autorisé. La comparaison est à temps constant pour éviter les attaques temporelles.
 * <p>
 * En cas d'échec : 401 SERVICE_AUTHENTICATION_FAILED, sans corps de session, sans redirect.
 */
@Component
public class InternalMachineAuthFilter extends OncePerRequestFilter {

    private static final String PREFIX_BASIC = "Basic ";

    private final byte[] utilisateurAttendu;
    private final byte[] secretAttendu;
    private final ObjectMapper objectMapper;

    public InternalMachineAuthFilter(
            @Value("${tarifs.internal.caller.user:}") String utilisateur,
            @Value("${tarifs.internal.caller.secret:}") String secret,
            ObjectMapper objectMapper) {
        // Stockage en bytes pour la comparaison à temps constant
        this.utilisateurAttendu = utilisateur.getBytes(StandardCharsets.UTF_8);
        this.secretAttendu      = secret.getBytes(StandardCharsets.UTF_8);
        this.objectMapper       = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Ce filtre s'applique uniquement aux routes /internal/**
        return !request.getRequestURI().startsWith("/internal/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if (utilisateurAttendu.length == 0 || secretAttendu.length == 0) {
            refuser(response, "Authentification machine non configurée");
            return;
        }

        if (header == null || !header.startsWith(PREFIX_BASIC)) {
            refuser(response, "En-tête Authorization Basic manquant");
            return;
        }

        String[] parties = decoder(header.substring(PREFIX_BASIC.length()));
        if (parties == null) {
            refuser(response, "En-tête Authorization Basic malformé");
            return;
        }

        byte[] utilisateurRecu = parties[0].getBytes(StandardCharsets.UTF_8);
        byte[] secretRecu      = parties[1].getBytes(StandardCharsets.UTF_8);

        boolean utilisateurOk = MessageDigest.isEqual(utilisateurAttendu, utilisateurRecu);
        boolean secretOk      = MessageDigest.isEqual(secretAttendu, secretRecu);

        if (!utilisateurOk || !secretOk) {
            refuser(response, "Identifiants machine invalides");
            return;
        }

        chain.doFilter(request, response);
    }

    // ── Utilitaires ───────────────────────────────────────────────────────────

    /**
     * Décode le segment Base64 et renvoie [utilisateur, secret], ou null si malformé.
     */
    private String[] decoder(String base64) {
        try {
            String decoded = new String(Base64.getDecoder().decode(base64), StandardCharsets.UTF_8);
            int colon = decoded.indexOf(':');
            if (colon < 0) return null;
            return new String[] { decoded.substring(0, colon), decoded.substring(colon + 1) };
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private void refuser(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader("Cache-Control", "no-store");
        objectMapper.writeValue(response.getOutputStream(),
                new ErreurResponse("SERVICE_AUTHENTICATION_FAILED", message));
    }
}
