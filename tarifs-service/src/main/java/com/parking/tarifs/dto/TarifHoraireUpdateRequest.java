package com.parking.tarifs.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * Corps de la requête PUT /api/tarifs/hourly.
 * Le nouveau tarif doit être strictement positif après arrondi.
 */
public record TarifHoraireUpdateRequest(
        @NotNull(message = "Le champ prixDh est obligatoire")
        @DecimalMin(value = "0.01", message = "Le tarif doit être supérieur ou égal à 0,01 DH")
        BigDecimal prixDh
) {
}

