package com.parking.tarifs.controller;

import com.parking.tarifs.dto.CalculRequest;
import com.parking.tarifs.dto.CalculResponse;
import com.parking.tarifs.exception.ReponsePartenaireInvalideException;
import com.parking.tarifs.exception.ServiceIndisponibleException;
import com.parking.tarifs.service.ReductionProvider;
import com.parking.tarifs.service.TarifService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Contrôleur des endpoints internes de calcul de tarif.
 * Protégés par {@link com.parking.tarifs.security.InternalMachineAuthFilter}.
 * <p>
 * POST /internal/tarifs/estimate — devis à la réservation<br>
 * POST /internal/tarifs/final   — montant final au départ
 */
@RestController
@RequestMapping("/internal/tarifs")
public class InternalTarifsController {

    private final TarifService tarifService;
    private final ReductionProvider reductionProvider;
    private final String currency;

    public InternalTarifsController(
            TarifService tarifService,
            ReductionProvider reductionProvider,
            @Value("${tarifs.currency:MAD}") String currency) {
        this.tarifService      = tarifService;
        this.reductionProvider = reductionProvider;
        this.currency          = currency;
    }

    /**
     * Calcule un devis pour la période réservée [debutPrevu, finPrevue].
     * La réduction est obtenue depuis Abonnements via conducteurId.
     */
    @PostMapping("/estimate")
    public ResponseEntity<CalculResponse> estimate(@RequestBody CalculRequest requete) {
        validerChampsDates(requete.debutPrevu(), requete.finPrevue(), "debutPrevu", "finPrevue");

        BigDecimal reduction  = obtenirReduction(requete.conducteurId());
        BigDecimal montant    = tarifService.calculerMontantEstime(
                requete.debutPrevu(), requete.finPrevue(), reduction);
        String reference      = "devis-" + hexAleatoire();

        return ResponseEntity.ok(new CalculResponse(montant, currency, reference));
    }

    /**
     * Calcule le montant final.
     * <ul>
     *   <li>Temps supplémentaire (quoteReference == null) : intervalle [arriveeReelle, departReel]
     *       représente uniquement la durée après la fin du créneau payé.</li>
     *   <li>Historique non prépayé (quoteReference != null) : intervalle [arriveeReelle, departReel]
     *       représente la durée réelle complète.</li>
     * </ul>
     * Dans les deux cas Réservations a déjà encodé le bon intervalle dans les champs ;
     * Tarifs applique simplement la formule sur cet intervalle.
     */
    @PostMapping("/final")
    public ResponseEntity<CalculResponse> finalAmount(@RequestBody CalculRequest requete) {
        OffsetDateTime debut = requete.arriveeReelle() != null ? requete.arriveeReelle() : requete.debutPrevu();
        OffsetDateTime fin   = requete.departReel() != null ? requete.departReel() : requete.finPrevue();
        validerChampsDates(debut, fin, "arriveeReelle (ou debutPrevu)", "departReel (ou finPrevue)");

        BigDecimal reduction = obtenirReduction(requete.conducteurId());
        BigDecimal montant   = tarifService.calculerMontantFinal(debut, fin, reduction);
        String reference     = "final-" + hexAleatoire();

        return ResponseEntity.ok(new CalculResponse(montant, currency, reference));
    }

    // ── Utilitaires ───────────────────────────────────────────────────────────

    /**
     * Obtient la réduction depuis Abonnements.
     * Lève {@link ServiceIndisponibleException} si Abonnements n'est pas disponible
     * (fail-closed : on ne simule jamais 0 % en production).
     */
    private BigDecimal obtenirReduction(String conducteurId) {
        if (conducteurId == null || conducteurId.isBlank()) {
            throw new IllegalArgumentException(
                    "Le champ conducteurId est obligatoire pour le calcul de la réduction.");
        }
        BigDecimal reduction = reductionProvider.getReductionPourcent(conducteurId);
        if (reduction == null || reduction.compareTo(BigDecimal.ZERO) < 0
                || reduction.compareTo(new BigDecimal("100")) > 0) {
            throw new ReponsePartenaireInvalideException(
                    "Le service Abonnements a retourné une réduction invalide : " + reduction);
        }
        return reduction;
    }

    private void validerChampsDates(OffsetDateTime debut, OffsetDateTime fin,
                                    String nomDebut, String nomFin) {
        if (debut == null) {
            throw new IllegalArgumentException("Le champ " + nomDebut + " est obligatoire.");
        }
        if (fin == null) {
            throw new IllegalArgumentException("Le champ " + nomFin + " est obligatoire.");
        }
    }

    /** Génère 8 caractères hexadécimaux aléatoires depuis un UUID. */
    private String hexAleatoire() {
        return HexFormat.of().toHexDigits(UUID.randomUUID().getMostSignificantBits()).substring(0, 8);
    }
}

