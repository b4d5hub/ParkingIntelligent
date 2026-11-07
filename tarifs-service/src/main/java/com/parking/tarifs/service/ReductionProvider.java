package com.parking.tarifs.service;

import java.math.BigDecimal;

/**
 * Contrat pour obtenir le pourcentage de réduction d'un conducteur.
 * <p>
 * Implémenté par l'adaptateur Abonnements en production.
 * Remplacé par un mock Mockito dans les tests unitaires,
 * afin de ne jamais déclencher d'appel HTTP réel.
 * <p>
 * Décision d'équipe : Réservations ne calcule jamais la réduction elle-même
 * et n'accepte aucune valeur venant du navigateur. TarifService reçoit
 * la réduction déjà résolue en paramètre ; c'est la couche appelante
 * (futur contrôleur REST) qui interroge ce fournisseur.
 */
public interface ReductionProvider {

    /**
     * Retourne le pourcentage de réduction applicable à ce conducteur.
     *
     * @param conducteurId identifiant du conducteur (chaîne décimale BIGINT)
     * @return réduction entre 0 et 100 inclus ; 0 si aucun abonnement valide
     */
    BigDecimal getReductionPourcent(String conducteurId);
}

