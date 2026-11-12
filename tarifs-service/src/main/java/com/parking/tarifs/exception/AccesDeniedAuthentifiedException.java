package com.parking.tarifs.exception;

/**
 * Levée lorsque l'utilisateur est authentifié mais n'a pas le rôle requis
 * ou que le jeton CSRF est absent/invalide.
 * Résultat HTTP attendu : 403 ACCESS_DENIED ou 403 CSRF_INVALID.
 */
public class AccesDeniedAuthentifiedException extends RuntimeException {

    private final String code;

    public AccesDeniedAuthentifiedException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}

