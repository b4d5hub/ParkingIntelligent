package com.parking.tarifs.exception;

/**
 * Levée lorsqu'un service partenaire (auth, abonnements) est inaccessible.
 * Résultat HTTP attendu : 503 SERVICE_UNAVAILABLE.
 */
public class ServiceIndisponibleException extends RuntimeException {

    public ServiceIndisponibleException(String message) {
        super(message);
    }

    public ServiceIndisponibleException(String message, Throwable cause) {
        super(message, cause);
    }
}

