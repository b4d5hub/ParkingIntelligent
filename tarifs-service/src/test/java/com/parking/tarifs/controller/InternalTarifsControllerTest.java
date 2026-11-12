package com.parking.tarifs.controller;

import tools.jackson.databind.ObjectMapper;
import com.parking.tarifs.dto.CalculRequest;
import com.parking.tarifs.exception.ServiceIndisponibleException;
import com.parking.tarifs.security.InternalMachineAuthFilter;
import com.parking.tarifs.security.TarifsSecurityConfig;
import com.parking.tarifs.service.ReductionProvider;
import com.parking.tarifs.service.TarifRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Tests du contrôleur interne — couche web uniquement (MockMvc).
 * Vérifie l'authentification machine, la validation des champs et la réponse JSON.
 */
@WebMvcTest(controllers = InternalTarifsController.class)
@Import({TarifsSecurityConfig.class, InternalMachineAuthFilter.class, GlobalErrorHandler.class})
@TestPropertySource(properties = {
        "tarifs.internal.caller.user=" + InternalTarifsControllerTest.USER_OK,
        "tarifs.internal.caller.secret=" + InternalTarifsControllerTest.SECRET_OK,
        "tarifs.currency=MAD"
})
class InternalTarifsControllerTest {

    static final String USER_OK   = "reservations-machine";
    static final String SECRET_OK = "mot-de-passe-test";

    private static final String BASIC_OK    = basicHeader(USER_OK, SECRET_OK);
    private static final String BASIC_WRONG = basicHeader(USER_OK, "mauvais-secret");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean TarifRepository repository;
    @MockitoBean ReductionProvider reductionProvider;

    @BeforeEach
    void initTarif() {
        when(repository.lireTarifCourant()).thenReturn(new BigDecimal("10.00"));
    }

    private static String basicHeader(String u, String p) {
        String creds = Base64.getEncoder().encodeToString(
                (u + ":" + p).getBytes(StandardCharsets.UTF_8));
        return "Basic " + creds;
    }

    private String corpsEstimate(OffsetDateTime debut, OffsetDateTime fin) throws Exception {
        CalculRequest req = new CalculRequest(
                "42", null, null, debut, fin, null, null, null, null);
        return mapper.writeValueAsString(req);
    }

    private String corpsFinal(OffsetDateTime arrivee, OffsetDateTime depart) throws Exception {
        CalculRequest req = new CalculRequest(
                "42", null, null, null, null, arrivee, depart, null, null);
        return mapper.writeValueAsString(req);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // POST /internal/tarifs/estimate
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    void estimate_sansBearerToken_retourne401() throws Exception {
        mvc.perform(post("/internal/tarifs/estimate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpsEstimate(
                                OffsetDateTime.parse("2026-11-10T08:00:00Z"),
                                OffsetDateTime.parse("2026-11-10T10:00:00Z"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SERVICE_AUTHENTICATION_FAILED"));
    }

    @Test
    void estimate_avecMauvaisSecret_retourne401() throws Exception {
        mvc.perform(post("/internal/tarifs/estimate")
                        .header("Authorization", BASIC_WRONG)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpsEstimate(
                                OffsetDateTime.parse("2026-11-10T08:00:00Z"),
                                OffsetDateTime.parse("2026-11-10T10:00:00Z"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SERVICE_AUTHENTICATION_FAILED"));
    }

    @Test
    void estimate_avecBonsCredentials_retourne200() throws Exception {
        when(reductionProvider.getReductionPourcent(anyString()))
                .thenReturn(BigDecimal.ZERO);

        mvc.perform(post("/internal/tarifs/estimate")
                        .header("Authorization", BASIC_OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpsEstimate(
                                OffsetDateTime.parse("2026-11-10T08:00:00Z"),
                                OffsetDateTime.parse("2026-11-10T10:00:00Z"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(20.0))
                .andExpect(jsonPath("$.currency").value("MAD"))
                .andExpect(jsonPath("$.reference").value(org.hamcrest.Matchers.startsWith("devis-")));
    }

    @Test
    void estimate_avecReduction30pourcent_appliqueueLaFormule() throws Exception {
        // 2h * 10 DH/h * (1 - 30/100) = 14,00 DH
        when(reductionProvider.getReductionPourcent(anyString()))
                .thenReturn(new BigDecimal("30"));

        mvc.perform(post("/internal/tarifs/estimate")
                        .header("Authorization", BASIC_OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpsEstimate(
                                OffsetDateTime.parse("2026-11-10T08:00:00Z"),
                                OffsetDateTime.parse("2026-11-10T10:00:00Z"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(14.0));
    }

    @Test
    void estimate_sansDebutPrevu_retourne400() throws Exception {
        CalculRequest req = new CalculRequest(
                "42", null, null, null,
                OffsetDateTime.parse("2026-11-10T10:00:00Z"),
                null, null, null, null);

        mvc.perform(post("/internal/tarifs/estimate")
                        .header("Authorization", BASIC_OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void estimate_abonnementsIndisponible_retourne503() throws Exception {
        when(reductionProvider.getReductionPourcent(anyString()))
                .thenThrow(new ServiceIndisponibleException("Abonnements non disponible"));

        mvc.perform(post("/internal/tarifs/estimate")
                        .header("Authorization", BASIC_OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpsEstimate(
                                OffsetDateTime.parse("2026-11-10T08:00:00Z"),
                                OffsetDateTime.parse("2026-11-10T10:00:00Z"))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"));
    }

    @Test
    void estimate_reductionInvalideParAbonnements_retourne502() throws Exception {
        // Réduction supérieure à 100% -> PARTNER_RESPONSE_INVALID
        when(reductionProvider.getReductionPourcent(anyString()))
                .thenReturn(new BigDecimal("150"));

        mvc.perform(post("/internal/tarifs/estimate")
                        .header("Authorization", BASIC_OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpsEstimate(
                                OffsetDateTime.parse("2026-11-10T08:00:00Z"),
                                OffsetDateTime.parse("2026-11-10T10:00:00Z"))))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("PARTNER_RESPONSE_INVALID"));
    }

    @Test
    void estimate_dateFinAvantDateDebut_retourne400() throws Exception {
        when(reductionProvider.getReductionPourcent(anyString()))
                .thenReturn(BigDecimal.ZERO);

        mvc.perform(post("/internal/tarifs/estimate")
                        .header("Authorization", BASIC_OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpsEstimate(
                                OffsetDateTime.parse("2026-11-10T10:00:00Z"),
                                OffsetDateTime.parse("2026-11-10T08:00:00Z"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // POST /internal/tarifs/final
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    void finalAmount_sansAuthentification_retourne401() throws Exception {
        mvc.perform(post("/internal/tarifs/final")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpsFinal(
                                OffsetDateTime.parse("2026-11-10T10:00:00Z"),
                                OffsetDateTime.parse("2026-11-10T11:30:00Z"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SERVICE_AUTHENTICATION_FAILED"));
    }

    @Test
    void finalAmount_avecBonsCredentials_retourne200AvecReference() throws Exception {
        // 1h30 * 10 DH/h = 15,00 DH
        when(reductionProvider.getReductionPourcent(anyString()))
                .thenReturn(BigDecimal.ZERO);

        mvc.perform(post("/internal/tarifs/final")
                        .header("Authorization", BASIC_OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpsFinal(
                                OffsetDateTime.parse("2026-11-10T10:00:00Z"),
                                OffsetDateTime.parse("2026-11-10T11:30:00Z"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(15.0))
                .andExpect(jsonPath("$.reference").value(org.hamcrest.Matchers.startsWith("final-")));
    }

    @Test
    void finalAmount_avecDatesPrevuesSeulement_utiliseFallbackEtRetourne200() throws Exception {
        // Test compatibilité : arriveeReelle/departReel nulls mais debutPrevu/finPrevue présents
        when(reductionProvider.getReductionPourcent(anyString()))
                .thenReturn(BigDecimal.ZERO);

        CalculRequest req = new CalculRequest(
                "42", null, null,
                OffsetDateTime.parse("2026-11-10T10:00:00Z"),
                OffsetDateTime.parse("2026-11-10T11:00:00Z"),
                null, null, null, false);

        mvc.perform(post("/internal/tarifs/final")
                        .header("Authorization", BASIC_OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(10.0))
                .andExpect(jsonPath("$.reference").value(org.hamcrest.Matchers.startsWith("final-")));
    }
}
