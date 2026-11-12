package com.parking.tarifs.dto;

import java.math.BigDecimal;

/**
 * Réponse de consultation du tarif horaire courant (GET /api/tarifs/hourly).
 *
 * @param prixDh   tarif en DH/h, arrondi à 2 décimales
 * @param currency devise ISO (ex. MAD)
 */
public record TarifHoraireResponse(BigDecimal prixDh, String currency) {
}

