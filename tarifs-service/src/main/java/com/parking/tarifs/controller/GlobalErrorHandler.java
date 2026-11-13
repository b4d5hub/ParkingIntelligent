package com.parking.tarifs.controller;

import com.parking.tarifs.dto.ErreurResponse;
import com.parking.tarifs.exception.*;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

/**
 * Gestionnaire global des exceptions : convertit chaque exception métier en réponse JSON normalisée.
 */
@RestControllerAdvice
public class GlobalErrorHandler {

    /** Validation Jakarta sur les corps de requête (@Valid). */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErreurResponse> requeteInvalide(MethodArgumentNotValidException ex) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + " : " + fe.getDefaultMessage())
                .findFirst()
                .orElse("Requête invalide");
        return erreur(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", detail);
    }

    /** Validation Jakarta sur les paramètres (@RequestParam, @PathVariable). */
    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ErreurResponse> violationContrainte(ConstraintViolationException ex) {
        return erreur(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", ex.getMessage());
    }

    /** Arguments métier invalides (ex. dates, montants). */
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ErreurResponse> argumentInvalide(IllegalArgumentException ex) {
        return erreur(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", ex.getMessage());
    }

    /** Aucun tarif configuré en base. */
    @ExceptionHandler(TarifManquantException.class)
    ResponseEntity<ErreurResponse> tarifManquant(TarifManquantException ex) {
        return erreur(HttpStatus.SERVICE_UNAVAILABLE, "TARIF_MANQUANT", ex.getMessage());
    }

    /** Session utilisateur absente, expirée ou révoquée. */
    @ExceptionHandler(AuthenticationRequiredException.class)
    ResponseEntity<ErreurResponse> nonAuthentifie(AuthenticationRequiredException ex) {
        return erreur(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED", ex.getMessage());
    }

    /** Rôle insuffisant ou CSRF invalide. */
    @ExceptionHandler(AccesDeniedAuthentifiedException.class)
    ResponseEntity<ErreurResponse> accesDenie(AccesDeniedAuthentifiedException ex) {
        return erreur(HttpStatus.FORBIDDEN, ex.getCode(), ex.getMessage());
    }

    /** Service partenaire renvoie une réponse inattendue. */
    @ExceptionHandler(ReponsePartenaireInvalideException.class)
    ResponseEntity<ErreurResponse> reponseInvalide(ReponsePartenaireInvalideException ex) {
        return erreur(HttpStatus.BAD_GATEWAY, "PARTNER_RESPONSE_INVALID", ex.getMessage());
    }

    /** Service partenaire inaccessible (timeout, auth service, abonnements). */
    @ExceptionHandler(ServiceIndisponibleException.class)
    ResponseEntity<ErreurResponse> serviceIndisponible(ServiceIndisponibleException ex) {
        return erreur(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE", ex.getMessage());
    }

    // ── Utilitaire ────────────────────────────────────────────────────────────

    private ResponseEntity<ErreurResponse> erreur(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status)
                .cacheControl(CacheControl.noStore())
                .body(new ErreurResponse(code, message));
    }
}

