package com.parking.tarifs.exception;

/**
 * Levée lorsqu'un service partenaire retourne une réponse invalide ou inattendue.
 * Résultat HTTP attendu : 502 BAD_GATEWAY.
 */
public class ReponsePartenaireInvalideException extends RuntimeException {

    public ReponsePartenaireInvalideException(String message) {
        super(message);
    }
}

