package com.parking.tarifs.service;

import java.math.BigDecimal;

/**
 * Contrat d'accès et de persistance du tarif horaire.
 * <p>
 * Découplé de la couche d'infrastructure (JPA, mémoire, etc.).
 * Permet d'isoler la logique métier de toute contrainte technique de stockage.
 */
public interface TarifRepository {

    /**
     * Retourne le tarif horaire actuellement en vigueur.
     *
     * @return montant horaire en DH/h
     */
    BigDecimal lireTarifCourant();

    /**
     * Enregistre un nouveau tarif horaire avec traçabilité de l'auteur.
     *
     * @param nouveauPrix tarif en DH/h, strictement positif
     * @param creePar identifiant de l'auteur de la modification (ex. userId)
     */
    void enregistrerNouveauTarif(BigDecimal nouveauPrix, String creePar);
}

