package com.parking.tarifs.dto;

import java.math.BigDecimal;

/**
 * Réponse retournée par /internal/tarifs/estimate et /internal/tarifs/final.
 * Contrat imposé par Réservations (ParkingGateway.Quote).
 *
 * @param amount   montant en devises, ≥ 0, au plus 2 décimales
 * @param currency code ISO de devise (ex. MAD)
 * @param reference référence unique, format "devis-XXXXXXXX" ou "final-XXXXXXXX"
 */
public record CalculResponse(BigDecimal amount, String currency, String reference) {
}

