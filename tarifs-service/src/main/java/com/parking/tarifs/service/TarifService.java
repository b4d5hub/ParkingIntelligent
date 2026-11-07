package com.parking.tarifs.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;

/**
 * Service métier pur de calcul des tarifs de stationnement.
 * <p>
 * Classe <strong>pure</strong> : aucune annotation Spring, aucun appel HTTP,
 * aucune dépendance directe à un framework ou une base de données.
 * <p>
 * Dépend de l'interface {@link TarifRepository} reçue par son constructeur
 * pour la lecture et la mise à jour du tarif horaire en vigueur.
 * <p>
 * Formule retenue par l'équipe :
 * <pre>
 *   montant = (duréeEnMinutes / 60) × tarifHoraire × (1 − réduction / 100)
 * </pre>
 * Résultat arrondi à 2 décimales, mode HALF_UP.
 * Devise : MAD (dirham marocain).
 * <p>
 * Pas de pénalité de dépassement : décision de l'équipe (facturation sur la durée réelle).
 */
public class TarifService {

    // ── Constantes ────────────────────────────────────────────────────────────

    private static final BigDecimal CENT               = new BigDecimal("100");
    private static final BigDecimal SOIXANTE_FOIS_CENT = new BigDecimal("6000");

    // ── Dépendances ───────────────────────────────────────────────────────────

    private final TarifRepository repository;

    // ── Constructeur ──────────────────────────────────────────────────────────

    /**
     * Initialise le service avec son contrat d'accès aux tarifs.
     *
     * @param repository fournisseur de stockage du tarif horaire (non nul)
     */
    public TarifService(TarifRepository repository) {
        if (repository == null) {
            throw new IllegalArgumentException("Le repository ne peut pas être nul.");
        }
        this.repository = repository;
    }

    // ── API publique ──────────────────────────────────────────────────────────

    /**
     * Calcule le montant estimé pour une durée prévue (devis).
     *
     * @param debut             date/heure de début prévue avec décalage horaire (non nulle)
     * @param fin               date/heure de fin prévue avec décalage horaire (non nulle, ≥ début)
     * @param reductionPourcent pourcentage de réduction (0 à 100 inclus)
     * @return montant estimé en DH, arrondi à 2 décimales
     * @throws IllegalArgumentException si dates nulles, fin antérieure au début, ou réduction invalide
     */
    public BigDecimal calculerMontantEstime(
            OffsetDateTime debut,
            OffsetDateTime fin,
            BigDecimal reductionPourcent) {

        validerDates(debut, fin);
        validerReduction(reductionPourcent);
        return calculer(debut, fin, reductionPourcent);
    }

    /**
     * Calcule le montant final basé sur l'arrivée et le départ réels.
     * Appelé par le personnel au départ du véhicule.
     *
     * @param arriveeReelle     date/heure d'arrivée réelle avec décalage horaire (non nulle)
     * @param departReel        date/heure de départ réel avec décalage horaire (non nulle, ≥ arrivée)
     * @param reductionPourcent pourcentage de réduction (0 à 100 inclus)
     * @return montant final en DH, arrondi à 2 décimales
     * @throws IllegalArgumentException mêmes règles de validation que calculerMontantEstime
     */
    public BigDecimal calculerMontantFinal(
            OffsetDateTime arriveeReelle,
            OffsetDateTime departReel,
            BigDecimal reductionPourcent) {

        validerDates(arriveeReelle, departReel);
        validerReduction(reductionPourcent);
        return calculer(arriveeReelle, departReel, reductionPourcent);
    }

    /**
     * Modifie le tarif horaire en vigueur (action réservée à un administrateur).
     *
     * @param nouveauPrix tarif horaire en DH/h, strictement positif
     * @param creePar     identifiant de l'auteur de la modification (non nul, non vide)
     * @throws IllegalArgumentException si nouveauPrix nul ou non strictement positif,
     *                                  ou si creePar est nul ou vide
     */
    public void modifierTarifHoraire(BigDecimal nouveauPrix, String creePar) {
        if (nouveauPrix == null) {
            throw new IllegalArgumentException("Le tarif horaire ne peut pas être nul.");
        }
        if (creePar == null || creePar.trim().isEmpty()) {
            throw new IllegalArgumentException(
                    "L'auteur de la modification (creePar) ne peut pas être vide.");
        }
        BigDecimal prixArrondi = nouveauPrix.setScale(2, RoundingMode.HALF_UP);
        if (prixArrondi.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(
                    "Le tarif horaire après arrondi à 2 décimales doit être strictement positif (reçu : "
                            + nouveauPrix + ", arrondi : " + prixArrondi + ").");
        }
        repository.enregistrerNouveauTarif(prixArrondi, creePar.trim());
    }

    /**
     * Consulte le tarif horaire actuellement en vigueur.
     *
     * @return tarif horaire en DH/h
     */
    public BigDecimal consulterTarifHoraire() {
        return repository.lireTarifCourant();
    }

    // ── Méthodes privées ──────────────────────────────────────────────────────

    private BigDecimal calculer(OffsetDateTime debut, OffsetDateTime fin, BigDecimal reductionPourcent) {
        long minutes = ChronoUnit.MINUTES.between(debut, fin);
        BigDecimal dureeMinutes = new BigDecimal(minutes);

        BigDecimal tarifHoraire = consulterTarifHoraire();

        // Calcul direct avec un seul arrondi final à 2 décimales (HALF_UP) :
        // numérateur = minutes × tarifHoraire × (100 − réduction)
        // dénominateur = 60 × 100 = 6000
        BigDecimal facteur = CENT.subtract(reductionPourcent);
        BigDecimal numerateur = dureeMinutes.multiply(tarifHoraire).multiply(facteur);

        return numerateur.divide(SOIXANTE_FOIS_CENT, 2, RoundingMode.HALF_UP);
    }

    private void validerDates(OffsetDateTime debut, OffsetDateTime fin) {
        if (debut == null || fin == null) {
            throw new IllegalArgumentException("Les dates de début et de fin ne peuvent pas être nulles.");
        }
        if (fin.isBefore(debut)) {
            throw new IllegalArgumentException(
                    "La date de fin ne peut pas être antérieure à la date de début.");
        }
    }

    private void validerReduction(BigDecimal reductionPourcent) {
        if (reductionPourcent == null) {
            throw new IllegalArgumentException("Le pourcentage de réduction ne peut pas être nul.");
        }
        if (reductionPourcent.compareTo(BigDecimal.ZERO) < 0
                || reductionPourcent.compareTo(CENT) > 0) {
            throw new IllegalArgumentException(
                    "La réduction doit être comprise entre 0 et 100 (reçu : " + reductionPourcent + ").");
        }
    }
}
