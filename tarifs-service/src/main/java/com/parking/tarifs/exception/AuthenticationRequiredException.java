package com.parking.tarifs.exception;

/**
 * Levée lorsque la session utilisateur est absente, expirée ou révoquée.
 * Résultat HTTP attendu : 401 AUTHENTICATION_REQUIRED.
 */
public class AuthenticationRequiredException extends RuntimeException {

    public AuthenticationRequiredException(String message) {
        super(message);
    }
}

