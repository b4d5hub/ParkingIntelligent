package com.parking.tarifs.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Entrée de l'historique du tarif horaire.
 *
 * @param id             identifiant unique de la ligne
 * @param prixDh         prix en DH/h
 * @param valableAPartir date/heure de prise d'effet
 * @param creePar        identifiant ou nom de l'administrateur ayant créé la ligne
 * @param creeLe         date/heure de création
 */
public record TarifHoraireHistoryItem(
        Long id,
        BigDecimal prixDh,
        OffsetDateTime valableAPartir,
        String creePar,
        OffsetDateTime creeLe
) {
}
