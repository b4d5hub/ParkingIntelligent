package com.parking.tarifs.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/**
 * Service métier de calcul des tarifs de stationnement.
 * <p>
 * Classe <strong>pure</strong> : pas d'annotation Spring, pas d'accès base
 * de données, pas d'appel HTTP. Elle peut être instanciée directement dans
 * les tests JUnit sans démarrer le contexte Spring.
 * <p>
 * Formule retenue par l'équipe :
 * <pre>
 *   montant = (duréeEnMinutes / 60) × tarifHoraire × (1 − réduction / 100)
 * </pre>
 * Résultat arrondi à 2 décimales, mode HALF_UP.
 * Devise : MAD (dirham marocain) — aucune conversion dans ce service.
 * <p>
 * Pas de pénalité de dépassement : décision de l'équipe (paiement au départ
 * sur la durée réelle uniquement).
 */
public class TarifService {

    // ── Constantes ────────────────────────────────────────────────────────────

    /** Utilisée pour convertir les minutes en heures et valider la réduction. */
    private static final BigDecimal SOIXANTE = new BigDecimal("60");
    private static final BigDecimal CENT     = new BigDecimal("100");

    /**
     * Précision intermédiaire pour les divisions (évite la perte d'information
     * avant l'arrondi final à 2 décimales).
     */
    private static final int PRECISION_INTERMEDIAIRE = 10;

    // ── État ──────────────────────────────────────────────────────────────────

    /** Tarif horaire courant, en DH/h. Valeur initiale : 10,00 DH. */
    private BigDecimal tarifHoraire;

    // ── Constructeur ──────────────────────────────────────────────────────────

    /** Crée le service avec le tarif horaire par défaut : 10,00 DH/h. */
    public TarifService() {
        this.tarifHoraire = new BigDecimal("10.00");
    }

    // ── API publique ──────────────────────────────────────────────────────────

    /**
     * Calcule le montant estimé pour une durée <em>prévue</em>.
     * Utilisé lors de la création d'un devis (arrivée/départ non encore connus).
     *
     * @param debut             date/heure de début prévue (non nulle)
     * @param fin               date/heure de fin prévue (non nulle, ≥ debut)
     * @param reductionPourcent réduction en % fournie par l'appelant (0 à 100 inclus)
     * @return montant en DH, à 2 décimales
     * @throws IllegalArgumentException si les dates sont nulles, fin avant début,
     *                                  ou réduction hors [0, 100]
     */
    public BigDecimal calculerMontantEstime(
            LocalDateTime debut,
            LocalDateTime fin,
            BigDecimal reductionPourcent) {

        validerDates(debut, fin);
        validerReduction(reductionPourcent);
        return calculer(debut, fin, reductionPourcent);
    }

    /**
     * Calcule le montant final basé sur l'arrivée et le départ <em>réels</em>.
     * Appelé par l'agent au moment du départ du véhicule.
     * Pas de pénalité de dépassement : décision de l'équipe.
     *
     * @param arriveeReelle     date/heure d'arrivée réelle (non nulle)
     * @param departReel        date/heure de départ réel (non nulle, ≥ arriveeReelle)
     * @param reductionPourcent réduction en % fournie par l'appelant (0 à 100 inclus)
     * @return montant en DH, à 2 décimales
     * @throws IllegalArgumentException mêmes règles que calculerMontantEstime
     */
    public BigDecimal calculerMontantFinal(
            LocalDateTime arriveeReelle,
            LocalDateTime departReel,
            BigDecimal reductionPourcent) {

        validerDates(arriveeReelle, departReel);
        validerReduction(reductionPourcent);
        return calculer(arriveeReelle, departReel, reductionPourcent);
    }

    /**
     * Modifie le tarif horaire (action réservée à un administrateur).
     * Le nouveau prix est arrondi à 2 décimales avant stockage.
     *
     * @param nouveauPrix nouveau tarif en DH/h, strictement positif
     * @throws IllegalArgumentException si le prix est null, nul ou négatif
     */
    public void modifierTarifHoraire(BigDecimal nouveauPrix) {
        if (nouveauPrix == null || nouveauPrix.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(
                    "Le tarif horaire doit être strictement positif (reçu : " + nouveauPrix + ").");
        }
        this.tarifHoraire = nouveauPrix.setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Retourne le tarif horaire actuellement en vigueur.
     *
     * @return tarif horaire en DH/h (toujours ≥ 2 décimales)
     */
    public BigDecimal consulterTarifHoraire() {
        return tarifHoraire;
    }

    // ── Méthodes privées ──────────────────────────────────────────────────────

    /**
     * Applique la formule commune :
     * <pre>montant = (minutes / 60) × tarifHoraire × (1 − réduction / 100)</pre>
     * La division par 60 utilise une précision intermédiaire de 10 décimales
     * pour éviter toute perte avant l'arrondi final.
     */
    private BigDecimal calculer(LocalDateTime debut, LocalDateTime fin, BigDecimal reductionPourcent) {
        long minutes = ChronoUnit.MINUTES.between(debut, fin);

        BigDecimal dureeMinutes = new BigDecimal(minutes);

        // duréeHeures = minutes / 60  (division entière évitée grâce à la précision intermédiaire)
        BigDecimal montantBrut = dureeMinutes
                .divide(SOIXANTE, PRECISION_INTERMEDIAIRE, RoundingMode.HALF_UP)
                .multiply(tarifHoraire);

        // facteur = 1 − (réduction / 100)
        BigDecimal facteurReduction = BigDecimal.ONE.subtract(
                reductionPourcent.divide(CENT, PRECISION_INTERMEDIAIRE, RoundingMode.HALF_UP));

        return montantBrut
                .multiply(facteurReduction)
                .setScale(2, RoundingMode.HALF_UP);
    }

    /** Vérifie que les deux dates sont non nulles et que fin n'est pas avant début. */
    private void validerDates(LocalDateTime debut, LocalDateTime fin) {
        if (debut == null || fin == null) {
            throw new IllegalArgumentException("Les dates de début et de fin ne peuvent pas être nulles.");
        }
        if (fin.isBefore(debut)) {
            throw new IllegalArgumentException(
                    "La date de fin ne peut pas être antérieure à la date de début.");
        }
    }

    /** Vérifie que la réduction est non nulle et comprise entre 0 et 100 inclus. */
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

