package com.parking.tarifs.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Implémentation en mémoire de {@link TarifRepository} destinée aux tests unitaires.
 * Ne nécessite aucune connexion à une base de données ni contexte Spring.
 */
public class InMemoryTarifRepository implements TarifRepository {

    private BigDecimal tarifCourant;

    public InMemoryTarifRepository() {
        this(new BigDecimal("10.00"));
    }

    public InMemoryTarifRepository(BigDecimal tarifInitial) {
        this.tarifCourant = tarifInitial != null
                ? tarifInitial.setScale(2, RoundingMode.HALF_UP)
                : new BigDecimal("10.00");
    }

    @Override
    public BigDecimal lireTarifCourant() {
        return tarifCourant;
    }

    @Override
    public void enregistrerNouveauTarif(BigDecimal nouveauPrix, String creePar) {
        if (nouveauPrix == null || nouveauPrix.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Le prix doit être strictement positif");
        }
        this.tarifCourant = nouveauPrix.setScale(2, RoundingMode.HALF_UP);
    }
}

