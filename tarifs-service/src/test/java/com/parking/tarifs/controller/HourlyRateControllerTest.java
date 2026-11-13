package com.parking.tarifs.controller;

import tools.jackson.databind.ObjectMapper;
import com.parking.tarifs.dto.TarifHoraireUpdateRequest;
import com.parking.tarifs.exception.AuthenticationRequiredException;
import com.parking.tarifs.exception.AccesDeniedAuthentifiedException;
import com.parking.tarifs.exception.ServiceIndisponibleException;
import com.parking.tarifs.security.AuthValidationClient;
import com.parking.tarifs.security.AuthValidationClient.UtilisateurValide;
import com.parking.tarifs.security.InternalMachineAuthFilter;
import com.parking.tarifs.security.TarifsSecurityConfig;
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
import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Tests du contrôleur utilisateur du tarif horaire — couche web uniquement (MockMvc).
 * Vérifie la validation de session, les rôles et la réponse JSON.
 */
@WebMvcTest(controllers = HourlyRateController.class)
@Import({TarifsSecurityConfig.class, InternalMachineAuthFilter.class, GlobalErrorHandler.class})
@TestPropertySource(properties = {
        "tarifs.internal.caller.user=unused",
        "tarifs.internal.caller.secret=unused",
        "tarifs.currency=MAD"
})
class HourlyRateControllerTest {

    private static final String SESSION_OK = "aabbccdd-1122-3344-5566-778899aabbcc";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean TarifRepository repository;
    @MockitoBean AuthValidationClient authClient;

    @BeforeEach
    void reinitMocks() {
        reset(authClient, repository);
        when(repository.lireTarifCourant()).thenReturn(new BigDecimal("10.00"));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GET /api/tarifs/hourly
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    void get_sansCookieSession_retourne401() throws Exception {
        mvc.perform(get("/api/tarifs/hourly"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
    }

    @Test
    void get_sessionExpireParAuthService_retourne401() throws Exception {
        when(authClient.valider(anyString(), eq("GET"), isNull()))
                .thenThrow(new AuthenticationRequiredException("Session expirée"));

        mvc.perform(get("/api/tarifs/hourly")
                        .cookie(new jakarta.servlet.http.Cookie("PARKING_SESSION", SESSION_OK)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
    }

    @Test
    void get_utilisateurConducteurAuthentifie_retourne200() throws Exception {
        when(authClient.valider(eq(SESSION_OK), eq("GET"), isNull()))
                .thenReturn(new UtilisateurValide("5", "Jean", List.of("CONDUCTEUR"), Instant.now()));

        mvc.perform(get("/api/tarifs/hourly")
                        .cookie(new jakarta.servlet.http.Cookie("PARKING_SESSION", SESSION_OK)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prixDh").value(10.0))
                .andExpect(jsonPath("$.currency").value("MAD"));
    }

    @Test
    void get_authServiceIndisponible_retourne503() throws Exception {
        when(authClient.valider(anyString(), eq("GET"), isNull()))
                .thenThrow(new ServiceIndisponibleException("Auth hors ligne"));

        mvc.perform(get("/api/tarifs/hourly")
                        .cookie(new jakarta.servlet.http.Cookie("PARKING_SESSION", SESSION_OK)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PUT /api/tarifs/hourly
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    void put_utilisateurConducteur_retourne403() throws Exception {
        when(authClient.valider(eq(SESSION_OK), eq("PUT"), anyString()))
                .thenReturn(new UtilisateurValide("5", "Jean", List.of("CONDUCTEUR"), Instant.now()));

        TarifHoraireUpdateRequest corps = new TarifHoraireUpdateRequest(new BigDecimal("15.00"));

        mvc.perform(put("/api/tarifs/hourly")
                        .cookie(new jakarta.servlet.http.Cookie("PARKING_SESSION", SESSION_OK))
                        .header("X-CSRF-TOKEN", "token-csrf")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(corps)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void put_csrfInvalide_retourne403() throws Exception {
        when(authClient.valider(eq(SESSION_OK), eq("PUT"), anyString()))
                .thenThrow(new AccesDeniedAuthentifiedException("CSRF_INVALID", "CSRF invalide"));

        TarifHoraireUpdateRequest corps = new TarifHoraireUpdateRequest(new BigDecimal("15.00"));

        mvc.perform(put("/api/tarifs/hourly")
                        .cookie(new jakarta.servlet.http.Cookie("PARKING_SESSION", SESSION_OK))
                        .header("X-CSRF-TOKEN", "mauvais-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(corps)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void put_adminAvecCsrfValide_modifieTarifEtRetourne200() throws Exception {
        when(authClient.valider(eq(SESSION_OK), eq("PUT"), eq("token-csrf-valide")))
                .thenReturn(new UtilisateurValide("1", "Admin", List.of("ADMIN"), Instant.now()));

        TarifHoraireUpdateRequest corps = new TarifHoraireUpdateRequest(new BigDecimal("12.50"));

        mvc.perform(put("/api/tarifs/hourly")
                        .cookie(new jakarta.servlet.http.Cookie("PARKING_SESSION", SESSION_OK))
                        .header("X-CSRF-TOKEN", "token-csrf-valide")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(corps)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prixDh").value(10.0))
                .andExpect(jsonPath("$.currency").value("MAD"));

        verify(repository).enregistrerNouveauTarif(new BigDecimal("12.50"), "1");
    }

    @Test
    void put_prixNul_retourne400SansAppelerLeRepository() throws Exception {
        when(authClient.valider(anyString(), anyString(), anyString()))
                .thenReturn(new UtilisateurValide("1", "Admin", List.of("ADMIN"), Instant.now()));

        mvc.perform(put("/api/tarifs/hourly")
                        .cookie(new jakarta.servlet.http.Cookie("PARKING_SESSION", SESSION_OK))
                        .header("X-CSRF-TOKEN", "token-csrf-valide")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prixDh\":null}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        verify(repository, never()).enregistrerNouveauTarif(any(), any());
    }

    @Test
    void put_authServiceIndisponible_retourne503() throws Exception {
        when(authClient.valider(anyString(), eq("PUT"), anyString()))
                .thenThrow(new ServiceIndisponibleException("Auth hors ligne"));

        TarifHoraireUpdateRequest corps = new TarifHoraireUpdateRequest(new BigDecimal("15.00"));

        mvc.perform(put("/api/tarifs/hourly")
                        .cookie(new jakarta.servlet.http.Cookie("PARKING_SESSION", SESSION_OK))
                        .header("X-CSRF-TOKEN", "token-csrf")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(corps)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"));
    }
}
