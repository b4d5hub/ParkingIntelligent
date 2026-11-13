package com.parking.tarifs.controller;

import com.parking.tarifs.dto.TarifHoraireResponse;
import com.parking.tarifs.dto.TarifHoraireUpdateRequest;
import com.parking.tarifs.exception.AccesDeniedAuthentifiedException;
import com.parking.tarifs.exception.AuthenticationRequiredException;
import com.parking.tarifs.security.AuthValidationClient;
import com.parking.tarifs.security.AuthValidationClient.UtilisateurValide;
import com.parking.tarifs.service.TarifService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;

/**
 * Contrôleur des endpoints utilisateur du tarif horaire.
 * La session est validée via {@link AuthValidationClient} (appel à Réservations).
 * <p>
 * GET /api/tarifs/hourly — lecture : tout utilisateur authentifié<br>
 * PUT /api/tarifs/hourly — modification : ADMIN uniquement, avec validation CSRF
 */
@RestController
@RequestMapping("/api/tarifs")
public class HourlyRateController {

    private static final String COOKIE_SESSION = "PARKING_SESSION";
    private static final String HEADER_CSRF    = "X-CSRF-TOKEN";

    private final TarifService tarifService;
    private final AuthValidationClient authClient;
    private final String currency;

    public HourlyRateController(
            TarifService tarifService,
            AuthValidationClient authClient,
            @Value("${tarifs.currency:MAD}") String currency) {
        this.tarifService = tarifService;
        this.authClient   = authClient;
        this.currency     = currency;
    }

    /**
     * Retourne le tarif horaire courant.
     * Accessible à tout utilisateur authentifié (CONDUCTEUR, AGENT, ADMIN).
     */
    @GetMapping("/hourly")
    public ResponseEntity<TarifHoraireResponse> consulter(HttpServletRequest requete) {
        String sessionCookie = extraireSessionCookie(requete);
        // Validation de session (GET = pas de CSRF requis)
        authClient.valider(sessionCookie, "GET", null);

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(new TarifHoraireResponse(tarifService.consulterTarifHoraire(), currency));
    }

    /**
     * Modifie le tarif horaire courant.
     * Réservé aux utilisateurs avec le rôle ADMIN. Validation CSRF obligatoire.
     * L'auteur est extrait de la session validée (jamais du corps JSON).
     */
    @PutMapping("/hourly")
    public ResponseEntity<TarifHoraireResponse> modifier(
            @Valid @RequestBody TarifHoraireUpdateRequest corps,
            HttpServletRequest requete) {

        String sessionCookie = extraireSessionCookie(requete);
        String csrfToken     = requete.getHeader(HEADER_CSRF);

        // Validation de session avec CSRF (PUT = mutant)
        UtilisateurValide utilisateur = authClient.valider(sessionCookie, "PUT", csrfToken);

        // Vérification du rôle ADMIN
        if (!utilisateur.hasRole("ADMIN")) {
            throw new AccesDeniedAuthentifiedException(
                    "ACCESS_DENIED",
                    "Le rôle ADMIN est requis pour modifier le tarif horaire.");
        }

        // L'auteur vient de la session, jamais du formulaire
        tarifService.modifierTarifHoraire(corps.prixDh(), utilisateur.userId());

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(new TarifHoraireResponse(tarifService.consulterTarifHoraire(), currency));
    }

    // ── Utilitaires ───────────────────────────────────────────────────────────

    /**
     * Extrait la valeur du cookie PARKING_SESSION depuis la requête HTTP originale.
     * Lève {@link AuthenticationRequiredException} si absent.
     */
    private String extraireSessionCookie(HttpServletRequest requete) {
        Cookie[] cookies = requete.getCookies();
        if (cookies != null) {
            return Arrays.stream(cookies)
                    .filter(c -> COOKIE_SESSION.equals(c.getName()))
                    .map(Cookie::getValue)
                    .findFirst()
                    .orElseThrow(() -> new AuthenticationRequiredException(
                            "Cookie PARKING_SESSION absent ou manquant."));
        }
        throw new AuthenticationRequiredException("Cookie PARKING_SESSION absent ou manquant.");
    }
}

