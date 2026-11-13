package com.parking.tarifs.dto;

/**
 * Réponse d'erreur standard retournée par tous les endpoints Tarifs.
 *
 * @param code    code machine lisible (ex. AUTHENTICATION_REQUIRED)
 * @param message description humaine de l'erreur
 */
public record ErreurResponse(String code, String message) {
}

