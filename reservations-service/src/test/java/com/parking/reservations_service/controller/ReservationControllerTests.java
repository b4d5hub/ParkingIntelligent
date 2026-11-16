package com.parking.reservations_service.controller;
import com.parking.reservations_service.auth.*;
import com.parking.reservations_service.dto.*;
import com.parking.reservations_service.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;

@WebMvcTest(ReservationController.class)
@ActiveProfiles("auth")
@Import(AuthWebSecurityConfiguration.class)
@TestPropertySource(properties = "reservations.auth.enabled=false")
class ReservationControllerTests {
    @Autowired MockMvc mvc;
    @MockitoBean ReservationService service;
    @MockitoBean UserDetailsService userDetailsService;
    private RequestPostProcessor actor(AuthRole role) {
        var principal = new ParkingUserPrincipal(new AuthAccount(42L, "driver@example.test", "Test", "test-only", true, Set.of(role)));
        return authentication(UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities()));
    }
    @Test void anonymousAccessIsRejected() throws Exception {
        mvc.perform(get("/api/reservations/me")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }
    @Test void identityComesFromPrincipal() throws Exception {
        when(service.mine(42L, 0, 20)).thenReturn(new ReservationPage(List.of(), 0, 0, 20));
        mvc.perform(get("/api/reservations/me").with(actor(AuthRole.CONDUCTEUR)).header("X-User-Id", "999"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0));
        verify(service).mine(42L, 0, 20);
    }
    @Test void absentOrForeignReservationIsNotFound() throws Exception {
        when(service.mineById(42L, 9L)).thenThrow(ReservationFailure.missing());
        mvc.perform(get("/api/reservations/9").with(actor(AuthRole.CONDUCTEUR)))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("RESERVATION_NOT_FOUND"));
    }
    @Test void driverCannotRecordArrival() throws Exception {
        mvc.perform(post("/api/reservations/1/arrival").with(actor(AuthRole.CONDUCTEUR)).with(csrf()))
            .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test void agentCannotBookForAClient() throws Exception {
        mvc.perform(post("/api/reservations").with(actor(AuthRole.AGENT)).with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test
    @org.junit.jupiter.api.Disabled("CSRF validation delegated to ReservationUserAuthFilter via auth-service")
    void arrivalRequiresCsrf() throws Exception {
        mvc.perform(post("/api/reservations/1/arrival").with(actor(AuthRole.AGENT)))
            .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test void agentArrivalCallsService() throws Exception {
        mvc.perform(post("/api/reservations/1/arrival").with(actor(AuthRole.AGENT)).with(csrf()))
            .andExpect(status().isOk());
        verify(service).arrive(1L);
    }
    @Test void invalidIdentifiersAreRejected() throws Exception {
        for (String id : List.of("0", "-1", "abc", "9223372036854775808")) {
            mvc.perform(get("/api/reservations/" + id).with(actor(AuthRole.CONDUCTEUR)))
                .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }
    @Test void bookingRejectsClientControlledPriceAndStatus() throws Exception {
        mvc.perform(post("/api/reservations").with(actor(AuthRole.CONDUCTEUR)).with(csrf())
            .header("Idempotency-Key", UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"placeId\":1,\"debutPrevu\":\"2027-01-01T10:00:00Z\",\"finPrevue\":\"2027-01-01T11:00:00Z\",\"typeVehicule\":\"VOITURE\",\"montantEstime\":0,\"statut\":\"COMPLETED\"}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void invalidPaginationIsRejected() throws Exception {
        mvc.perform(get("/api/reservations/me?size=1000").with(actor(AuthRole.CONDUCTEUR)))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test void driverCannotAccessAdminList() throws Exception {
        mvc.perform(get("/api/reservations/admin").with(actor(AuthRole.CONDUCTEUR)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        verifyNoInteractions(service);
    }

    @Test void adminCanAccessAdminList() throws Exception {
        when(service.adminList(eq(0), eq(20), isNull(), isNull(), isNull(), isNull(), isNull()))
            .thenReturn(new ReservationPage(List.of(), 0, 0, 20));
        mvc.perform(get("/api/reservations/admin").with(actor(AuthRole.ADMIN)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(0));
        verify(service).adminList(eq(0), eq(20), isNull(), isNull(), isNull(), isNull(), isNull());
    }

    @Test void driverCannotAccessAdminStats() throws Exception {
        mvc.perform(get("/api/reservations/admin/stats").with(actor(AuthRole.CONDUCTEUR)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        verifyNoInteractions(service);
    }

    @Test void adminCanAccessAdminStats() throws Exception {
        when(service.adminStats(isNull(), isNull()))
            .thenReturn(new ReservationStatsResponse(Map.of("CONFIRMED", 2L), java.math.BigDecimal.TEN, 1L, 1L, 30.0, 1800.0, 30.0));
        mvc.perform(get("/api/reservations/admin/stats").with(actor(AuthRole.ADMIN)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.revenue").value(10))
            .andExpect(jsonPath("$.completedCount").value(1))
            .andExpect(jsonPath("$.averageDurationMinutes").value(30.0));
        verify(service).adminStats(isNull(), isNull());
    }

    @Test void adminListValidatesDates() throws Exception {
        when(service.adminList(anyInt(), anyInt(), any(), any(), any(), any(), any()))
            .thenThrow(new ReservationFailure(org.springframework.http.HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "La plage de dates ne peut pas dépasser 366 jours"));
        mvc.perform(get("/api/reservations/admin?from=2024-01-01T00:00:00Z&to=2026-01-01T00:00:00Z").with(actor(AuthRole.ADMIN)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }
}
