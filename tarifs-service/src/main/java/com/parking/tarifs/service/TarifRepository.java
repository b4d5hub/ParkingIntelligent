package com.parking.tarifs.service;

import com.parking.tarifs.dto.TarifHoraireHistoryPage;

import java.math.BigDecimal;

/**
 * Contrat de persistance du tarif horaire.
 * <p>
 * Défini dans la couche métier pure ; implémenté par les adapters d'infrastructure
 * (base de données de production ou double en mémoire pour les tests).
 */
public interface TarifRepository {

    /**
     * Lit le tarif horaire en vigueur au moment de l'appel.
     *
     * @return montant en DH/h
     */
    BigDecimal lireTarifCourant();

    /**
     * Enregistre un nouveau tarif horaire avec prise d'effet immédiate.
     *
     * @param nouveauPrix montant en DH/h, strictement positif
     * @param creePar     identifiant de l'auteur
     */
    void enregistrerNouveauTarif(BigDecimal nouveauPrix, String creePar);

    /**
     * Consulte l'historique paginé des tarifs horaires (plus récent en premier).
     *
     * @param page numéro de page (0-based)
     * @param size taille de la page
     * @return page de résultats
     */
    TarifHoraireHistoryPage consulterHistorique(int page, int size);
}
