package com.parking.tarifs.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Corps de requête envoyé par Réservations aux endpoints de calcul internes.
 * Tous les champs optionnels (null autorisé) car le contrat Réservations
 * les envoie ou non selon le scénario (devis, final, dépassement).
 */
public record CalculRequest(
        String conducteurId,
        String placeId,
        String typeVehicule,
        OffsetDateTime debutPrevu,
        OffsetDateTime finPrevue,
        OffsetDateTime arriveeReelle,
        OffsetDateTime departReel,
        String quoteReference,
        Boolean overstayPenalty
) {
}

