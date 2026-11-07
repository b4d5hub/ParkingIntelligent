package com.parking.tarifs.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests unitaires de TarifService.
 * <p>
 * Classe pure : aucun contexte Spring, aucun serveur REST, aucune base de données.
 * TarifService est instancié directement avec un InMemoryTarifRepository.
 */
@DisplayName("Tests unitaires de TarifService")
class TarifServiceTest {

    private TarifRepository repository;
    private TarifService service;

    /** Tarif horaire par défaut injecté lors de la création : 10,00 DH/h. */
    private static final BigDecimal TARIF_DEFAUT = new BigDecimal("10.00");

    /** Décalage standard (+01:00) utilisé pour les tests unitaires. */
    private static final ZoneOffset OFFSET_HEURE = ZoneOffset.ofHours(1);

    @BeforeEach
    void initialiser() {
        repository = new InMemoryTarifRepository(TARIF_DEFAUT);
        service = new TarifService(repository);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CAS NORMAUX
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Cas normal : 90 minutes à 10 DH/h sans réduction doit retourner 15,00 DH")
    void montantEstime_90minSansReduction_retourne15DH() {
        // 90 min / 60 × 10 DH/h × 1,00 = 15,00
        OffsetDateTime debut = OffsetDateTime.of(2026, 11, 7, 9, 0, 0, 0, OFFSET_HEURE);
        OffsetDateTime fin   = OffsetDateTime.of(2026, 11, 7, 10, 30, 0, 0, OFFSET_HEURE);

        BigDecimal resultat = service.calculerMontantEstime(debut, fin, BigDecimal.ZERO);

        assertEquals(new BigDecimal("15.00"), resultat,
                "90 minutes sans réduction doit donner 15,00 DH");
    }

    @Test
    @DisplayName("Cas normal : 3 heures à 10 DH/h avec 20 % de réduction doit retourner 24,00 DH")
    void montantFinal_3hAvecReduction20Pourcent_retourne24DH() {
        // 180 min / 60 × 10 DH/h × 0,80 = 24,00
        OffsetDateTime arrivee = OffsetDateTime.of(2026, 11, 7, 8, 0, 0, 0, OFFSET_HEURE);
        OffsetDateTime depart  = OffsetDateTime.of(2026, 11, 7, 11, 0, 0, 0, OFFSET_HEURE);

        BigDecimal resultat = service.calculerMontantFinal(arrivee, depart, new BigDecimal("20"));

        assertEquals(new BigDecimal("24.00"), resultat,
                "3 heures avec 20 % de réduction doit donner 24,00 DH");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CAS LIMITES
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Cas limite : début égal à fin (0 minute) doit retourner 0,00 DH")
    void montantEstime_debutEgalFin_retourneZero() {
        // 0 min / 60 × n'importe quoi = 0,00
        OffsetDateTime instant = OffsetDateTime.of(2026, 11, 7, 10, 0, 0, 0, OFFSET_HEURE);

        BigDecimal resultat = service.calculerMontantEstime(instant, instant, BigDecimal.ZERO);

        assertEquals(new BigDecimal("0.00"), resultat,
                "Durée nulle doit produire un montant de 0,00 DH");
    }

    @Test
    @DisplayName("Cas limite : réduction de 100 % doit toujours retourner 0,00 DH")
    void montantEstime_reduction100Pourcent_retourneZero() {
        // facteur = 1 − 100/100 = 0 → montant = 0,00
        OffsetDateTime debut = OffsetDateTime.of(2026, 11, 7, 9, 0, 0, 0, OFFSET_HEURE);
        OffsetDateTime fin   = OffsetDateTime.of(2026, 11, 7, 11, 0, 0, 0, OFFSET_HEURE);

        BigDecimal resultat = service.calculerMontantEstime(debut, fin, new BigDecimal("100"));

        assertEquals(new BigDecimal("0.00"), resultat,
                "Une réduction de 100 % doit annuler le montant");
    }

    @Test
    @DisplayName("Cas limite : réduction de 0 % doit retourner le montant plein sans altération")
    void montantEstime_reduction0Pourcent_retourneMontantPlein() {
        // 60 min / 60 × 10 DH/h × 1,00 = 10,00
        OffsetDateTime debut = OffsetDateTime.of(2026, 11, 7, 9, 0, 0, 0, OFFSET_HEURE);
        OffsetDateTime fin   = OffsetDateTime.of(2026, 11, 7, 10, 0, 0, 0, OFFSET_HEURE);

        BigDecimal resultat = service.calculerMontantEstime(debut, fin, BigDecimal.ZERO);

        assertEquals(new BigDecimal("10.00"), resultat,
                "0 % de réduction ne doit pas modifier le montant");
    }

    @Test
    @DisplayName("Cas limite : 1 minute à 10 DH/h doit s'arrondir correctement (HALF_UP)")
    void montantEstime_1Minute_arrondissementHalfUp() {
        // 1 min / 60 × 10 DH/h = 0,16666… → arrondi HALF_UP = 0,17
        OffsetDateTime debut = OffsetDateTime.of(2026, 11, 7, 9, 0, 0, 0, OFFSET_HEURE);
        OffsetDateTime fin   = OffsetDateTime.of(2026, 11, 7, 9, 1, 0, 0, OFFSET_HEURE);

        BigDecimal resultat = service.calculerMontantEstime(debut, fin, BigDecimal.ZERO);

        assertEquals(new BigDecimal("0.17"), resultat,
                "1 minute doit s'arrondir à 0,17 DH (HALF_UP)");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CAS D'ERREUR
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Erreur : fin avant début doit lever IllegalArgumentException")
    void montantEstime_finAvantDebut_leveIllegalArgumentException() {
        OffsetDateTime debut = OffsetDateTime.of(2026, 11, 7, 10, 0, 0, 0, OFFSET_HEURE);
        OffsetDateTime fin   = OffsetDateTime.of(2026, 11, 7, 9, 0, 0, 0, OFFSET_HEURE); // antérieure

        assertThrows(IllegalArgumentException.class,
                () -> service.calculerMontantEstime(debut, fin, BigDecimal.ZERO),
                "Une fin antérieure au début doit déclencher IllegalArgumentException");
    }

    @Test
    @DisplayName("Erreur : tarif horaire négatif doit lever IllegalArgumentException")
    void modifierTarifHoraire_prixNegatif_leveIllegalArgumentException() {
        assertThrows(IllegalArgumentException.class,
                () -> service.modifierTarifHoraire(new BigDecimal("-5"), "admin-1"),
                "Un tarif négatif doit déclencher IllegalArgumentException");
    }

    @Test
    @DisplayName("Erreur : tarif horaire zéro doit lever IllegalArgumentException")
    void modifierTarifHoraire_prixZero_leveIllegalArgumentException() {
        assertThrows(IllegalArgumentException.class,
                () -> service.modifierTarifHoraire(BigDecimal.ZERO, "admin-1"),
                "Un tarif nul doit déclencher IllegalArgumentException");
    }

    @Test
    @DisplayName("Erreur : réduction de 101 % doit lever IllegalArgumentException")
    void montantEstime_reduction101Pourcent_leveIllegalArgumentException() {
        OffsetDateTime debut = OffsetDateTime.of(2026, 11, 7, 9, 0, 0, 0, OFFSET_HEURE);
        OffsetDateTime fin   = OffsetDateTime.of(2026, 11, 7, 10, 0, 0, 0, OFFSET_HEURE);

        assertThrows(IllegalArgumentException.class,
                () -> service.calculerMontantEstime(debut, fin, new BigDecimal("101")),
                "Une réduction > 100 doit déclencher IllegalArgumentException");
    }

    @Test
    @DisplayName("Erreur : réduction de −1 % doit lever IllegalArgumentException")
    void montantEstime_reductionNegative_leveIllegalArgumentException() {
        OffsetDateTime debut = OffsetDateTime.of(2026, 11, 7, 9, 0, 0, 0, OFFSET_HEURE);
        OffsetDateTime fin   = OffsetDateTime.of(2026, 11, 7, 10, 0, 0, 0, OFFSET_HEURE);

        assertThrows(IllegalArgumentException.class,
                () -> service.calculerMontantEstime(debut, fin, new BigDecimal("-1")),
                "Une réduction négative doit déclencher IllegalArgumentException");
    }

    @Test
    @DisplayName("Erreur : dates nulles doivent lever IllegalArgumentException")
    void montantEstime_datesNulles_leveIllegalArgumentException() {
        OffsetDateTime maintenant = OffsetDateTime.now(OFFSET_HEURE);

        // null en position début
        assertThrows(IllegalArgumentException.class,
                () -> service.calculerMontantEstime(null, maintenant, BigDecimal.ZERO),
                "Un début null doit déclencher IllegalArgumentException");

        // null en position fin
        assertThrows(IllegalArgumentException.class,
                () -> service.calculerMontantEstime(maintenant, null, BigDecimal.ZERO),
                "Une fin null doit déclencher IllegalArgumentException");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SIMULATION D'ABONNEMENTS AVEC MOCKITO
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Intégration simulée : réduction fournie par un ReductionProvider mocké (Abonnements)")
    void montantFinal_avecReductionProviderMocke_retourneMontantCorrect() {
        ReductionProvider abonnementsMock = Mockito.mock(ReductionProvider.class);
        Mockito.when(abonnementsMock.getReductionPourcent("42"))
               .thenReturn(new BigDecimal("20"));

        BigDecimal reduction = abonnementsMock.getReductionPourcent("42");

        OffsetDateTime arrivee = OffsetDateTime.of(2026, 11, 7, 8, 0, 0, 0, OFFSET_HEURE);
        OffsetDateTime depart  = OffsetDateTime.of(2026, 11, 7, 11, 0, 0, 0, OFFSET_HEURE); // 180 min

        // 180 / 60 × 10 × 0,80 = 24,00
        BigDecimal resultat = service.calculerMontantFinal(arrivee, depart, reduction);

        assertEquals(new BigDecimal("24.00"), resultat,
                "La réduction fournie par Abonnements (mock 20 %) doit produire 24,00 DH");
        Mockito.verify(abonnementsMock).getReductionPourcent("42");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CONSULTER ET MODIFIER LE TARIF HORAIRE
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Consultation : le tarif horaire par défaut doit être 10,00 DH")
    void consulterTarifHoraire_tariDefaut_retourne10DH() {
        assertEquals(TARIF_DEFAUT, service.consulterTarifHoraire(),
                "Le tarif initial doit être 10,00 DH/h");
    }

    @Test
    @DisplayName("Modification : un nouveau tarif valide doit remplacer l'ancien")
    void modifierTarifHoraire_prixValide_miseAJourEffective() {
        service.modifierTarifHoraire(new BigDecimal("15"), "admin-1");

        assertEquals(new BigDecimal("15.00"), service.consulterTarifHoraire(),
                "Après modification, le tarif doit être 15,00 DH/h");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // DEUX NOUVEAUX TESTS (ÉTAPE B1)
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Nouveau test B1 : deux décalages horaires distincts mesurent la durée réelle exacte")
    void montantEstime_offsetsDifferents_calculeDureeReelleCorrectement() {
        // Début : 09:00 à +01:00 (équivaut à 08:00 UTC)
        OffsetDateTime debut = OffsetDateTime.of(2026, 11, 7, 9, 0, 0, 0, ZoneOffset.ofHours(1));
        // Fin : 10:30 à +02:00 (équivaut à 08:30 UTC)
        OffsetDateTime fin   = OffsetDateTime.of(2026, 11, 7, 10, 30, 0, 0, ZoneOffset.ofHours(2));

        // Durée réelle écoulée = 30 minutes
        // 30 min / 60 × 10,00 DH/h × 1,00 = 5,00 DH
        BigDecimal resultat = service.calculerMontantEstime(debut, fin, BigDecimal.ZERO);

        assertEquals(new BigDecimal("5.00"), resultat,
                "La durée réelle entre 08:00 UTC et 08:30 UTC est de 30 min, soit 5,00 DH");
    }

    @Test
    @DisplayName("Nouveau test B1 : creePar nul ou vide doit lever IllegalArgumentException")
    void modifierTarifHoraire_creeParInvalide_leveIllegalArgumentException() {
        // creePar est null
        assertThrows(IllegalArgumentException.class,
                () -> service.modifierTarifHoraire(new BigDecimal("15"), null),
                "Un auteur null doit déclencher IllegalArgumentException");

        // creePar est vide ou ne contient que des espaces
        assertThrows(IllegalArgumentException.class,
                () -> service.modifierTarifHoraire(new BigDecimal("15"), "   "),
                "Un auteur vide doit déclencher IllegalArgumentException");
    }
}
