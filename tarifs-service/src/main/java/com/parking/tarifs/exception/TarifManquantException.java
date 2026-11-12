package com.parking.tarifs.exception;

/**
 * Levée lorsque aucun tarif horaire n'est configuré en base.
 * Résultat HTTP attendu : 503 SERVICE_UNAVAILABLE.
 */
public class TarifManquantException extends RuntimeException {

    public TarifManquantException(String message) {
        super(message);
    }
}

