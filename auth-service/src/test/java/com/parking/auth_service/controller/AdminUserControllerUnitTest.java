package com.parking.auth_service.controller;

import com.parking.auth_service.config.AuthAccountConfiguration;
import com.parking.auth_service.dto.*;
import com.parking.auth_service.model.AuthAccount;
import com.parking.auth_service.model.AuthRole;
import com.parking.auth_service.repository.JdbcAuthAccountRepository;
import com.parking.auth_service.security.ParkingUserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.MapSession;
import org.springframework.session.MapSessionRepository;
import org.springframework.session.Session;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AdminUserControllerUnitTest {

    private final JdbcAuthAccountRepository accountRepository = mock(JdbcAuthAccountRepository.class);
    private final PasswordEncoder passwordEncoder = new AuthAccountConfiguration().passwordEncoder();
    private FindByIndexNameSessionRepository<Session> sessionRepository;
    private AdminUserController controller;

    private final Long adminId = 1L;
    private final String adminEmail = "admin@parking.local";
    private ParkingUserPrincipal adminPrincipal;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        MapSessionRepository mapSessionRepo = new MapSessionRepository(new ConcurrentHashMap<>());
        sessionRepository = mock(FindByIndexNameSessionRepository.class);

        ObjectProvider<FindByIndexNameSessionRepository<? extends Session>> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn((FindByIndexNameSessionRepository) sessionRepository);

        controller = new AdminUserController(accountRepository, passwordEncoder, provider);

        AuthAccount adminAccount = new AuthAccount(
                adminId, adminEmail, "Admin User", "hash", true, Set.of(AuthRole.ADMIN), Instant.now()
        );
        adminPrincipal = new ParkingUserPrincipal(adminAccount);
    }

    @Test
    void listUsersReturnsPaginatedSummaryWithoutPasswordHash() {
        AuthAccount user1 = new AuthAccount(1L, "u1@test.local", "User 1", "secret-hash-1", true, Set.of(AuthRole.ADMIN), Instant.now());
        AuthAccount user2 = new AuthAccount(2L, "u2@test.local", "User 2", "secret-hash-2", false, Set.of(AuthRole.CONDUCTEUR), Instant.now());
        var pageResult = new JdbcAuthAccountRepository.PageResult<>(List.of(user1, user2), 2L, 0, 20, 1);
        when(accountRepository.findAll(0, 20, null)).thenReturn(pageResult);

        ResponseEntity<AdminUserPageResponse> response = controller.listUsers(0, 20, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        AdminUserPageResponse body = response.getBody();
        assertNotNull(body);
        assertEquals(2, body.content().size());
        assertEquals(2L, body.totalElements());
        assertEquals(0, body.page());
        assertEquals(20, body.size());

        // Verify password hash is not exposed
        AdminUserSummaryResponse r1 = body.content().get(0);
        assertEquals(1L, r1.id());
        assertEquals("u1@test.local", r1.email());
        assertEquals("User 1", r1.displayName());
        assertTrue(r1.enabled());
        assertEquals(List.of("ADMIN"), r1.roles());
    }

    @Test
    void listUsersValidatesPaginationParameters() {
        AdminException ex1 = assertThrows(AdminException.class, () -> controller.listUsers(-1, 20, null));
        assertEquals(HttpStatus.BAD_REQUEST, ex1.status());

        AdminException ex2 = assertThrows(AdminException.class, () -> controller.listUsers(0, 0, null));
        assertEquals(HttpStatus.BAD_REQUEST, ex2.status());

        AdminException ex3 = assertThrows(AdminException.class, () -> controller.listUsers(0, 101, null));
        assertEquals(HttpStatus.BAD_REQUEST, ex3.status());
    }

    @Test
    void createUserSuccessfullyWithArgon2Hash() {
        AdminCreateUserRequest req = new AdminCreateUserRequest(
                "newuser@parking.local",
                "New User",
                "ValidSecretPassphrase2026!",
                List.of("CONDUCTEUR", "AGENT")
        );
        when(accountRepository.existsByEmail("newuser@parking.local")).thenReturn(false);

        AuthAccount created = new AuthAccount(
                10L, "newuser@parking.local", "New User", "argon2-hash", true,
                Set.of(AuthRole.CONDUCTEUR, AuthRole.AGENT), Instant.now()
        );
        when(accountRepository.create(eq("newuser@parking.local"), eq("New User"), anyString(), eq(true), anySet()))
                .thenReturn(created);

        ResponseEntity<AdminUserSummaryResponse> response = controller.createUser(adminPrincipal, req);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        AdminUserSummaryResponse body = response.getBody();
        assertNotNull(body);
        assertEquals(10L, body.id());
        assertEquals("newuser@parking.local", body.email());
        assertTrue(body.enabled());
        assertEquals(List.of("AGENT", "CONDUCTEUR"), body.roles());

        // Verify that password was encoded with Argon2id
        verify(accountRepository).create(
                eq("newuser@parking.local"),
                eq("New User"),
                argThat(hash -> hash.startsWith("{argon2}")),
                eq(true),
                eq(Set.of(AuthRole.CONDUCTEUR, AuthRole.AGENT))
        );
    }

    @Test
    void createUserValidationErrors() {
        // Invalid email
        AdminCreateUserRequest badEmail = new AdminCreateUserRequest("invalid-email", "Name", "ValidSecretPassphrase2026!", List.of("ADMIN"));
        AdminException e1 = assertThrows(AdminException.class, () -> controller.createUser(adminPrincipal, badEmail));
        assertEquals(HttpStatus.BAD_REQUEST, e1.status());

        // Blank display name
        AdminCreateUserRequest badName = new AdminCreateUserRequest("u@test.local", "   ", "ValidSecretPassphrase2026!", List.of("ADMIN"));
        AdminException e2 = assertThrows(AdminException.class, () -> controller.createUser(adminPrincipal, badName));
        assertEquals(HttpStatus.BAD_REQUEST, e2.status());

        // Password too short (< 12 chars)
        AdminCreateUserRequest shortPass = new AdminCreateUserRequest("u@test.local", "Name", "short123", List.of("ADMIN"));
        AdminException e3 = assertThrows(AdminException.class, () -> controller.createUser(adminPrincipal, shortPass));
        assertEquals(HttpStatus.BAD_REQUEST, e3.status());
        assertEquals("Le mot de passe doit comporter au moins 12 caractères", e3.getMessage());

        // Empty roles
        AdminCreateUserRequest emptyRoles = new AdminCreateUserRequest("u@test.local", "Name", "ValidSecretPassphrase2026!", List.of());
        AdminException e4 = assertThrows(AdminException.class, () -> controller.createUser(adminPrincipal, emptyRoles));
        assertEquals(HttpStatus.BAD_REQUEST, e4.status());

        // Invalid role name
        AdminCreateUserRequest badRole = new AdminCreateUserRequest("u@test.local", "Name", "ValidSecretPassphrase2026!", List.of("SUPERADMIN"));
        AdminException e5 = assertThrows(AdminException.class, () -> controller.createUser(adminPrincipal, badRole));
        assertEquals(HttpStatus.BAD_REQUEST, e5.status());
    }

    @Test
    void createUserRejectsDuplicateEmail() {
        AdminCreateUserRequest req = new AdminCreateUserRequest(
                "existing@parking.local", "Name", "ValidSecretPassphrase2026!", List.of("CONDUCTEUR")
        );
        when(accountRepository.existsByEmail("existing@parking.local")).thenReturn(true);

        AdminException ex = assertThrows(AdminException.class, () -> controller.createUser(adminPrincipal, req));
        assertEquals(HttpStatus.CONFLICT, ex.status());
        assertEquals("EMAIL_ALREADY_EXISTS", ex.code());
    }

    @Test
    void updateUserNotFound() {
        when(accountRepository.findById(999L)).thenReturn(Optional.empty());

        AdminUpdateUserRequest req = new AdminUpdateUserRequest(true, null, null, null);
        AdminException ex = assertThrows(AdminException.class, () -> controller.updateUser(adminPrincipal, 999L, req));
        assertEquals(HttpStatus.NOT_FOUND, ex.status());
        assertEquals("USER_NOT_FOUND", ex.code());
    }

    @Test
    void adminCannotDisableThemselves() {
        AuthAccount self = new AuthAccount(adminId, adminEmail, "Admin", "h", true, Set.of(AuthRole.ADMIN), Instant.now());
        when(accountRepository.findById(adminId)).thenReturn(Optional.of(self));

        AdminUpdateUserRequest req = new AdminUpdateUserRequest(false, null, null, null);
        AdminException ex = assertThrows(AdminException.class, () -> controller.updateUser(adminPrincipal, adminId, req));
        assertEquals(HttpStatus.CONFLICT, ex.status());
        assertTrue(ex.getMessage().contains("désactiver son propre compte"));
    }

    @Test
    void adminCannotRemoveOwnAdminRole() {
        AuthAccount self = new AuthAccount(adminId, adminEmail, "Admin", "h", true, Set.of(AuthRole.ADMIN), Instant.now());
        when(accountRepository.findById(adminId)).thenReturn(Optional.of(self));

        AdminUpdateUserRequest req = new AdminUpdateUserRequest(null, null, List.of("CONDUCTEUR"), null);
        AdminException ex = assertThrows(AdminException.class, () -> controller.updateUser(adminPrincipal, adminId, req));
        assertEquals(HttpStatus.CONFLICT, ex.status());
        assertTrue(ex.getMessage().contains("retirer son propre rôle ADMIN"));
    }

    @Test
    void cannotDisableLastEnabledAdmin() {
        Long otherAdminId = 2L;
        AuthAccount otherAdmin = new AuthAccount(otherAdminId, "admin2@parking.local", "Admin 2", "h", true, Set.of(AuthRole.ADMIN), Instant.now());
        when(accountRepository.findById(otherAdminId)).thenReturn(Optional.of(otherAdmin));
        when(accountRepository.countEnabledAdmins()).thenReturn(1);

        AdminUpdateUserRequest req = new AdminUpdateUserRequest(false, null, null, null);
        AdminException ex = assertThrows(AdminException.class, () -> controller.updateUser(adminPrincipal, otherAdminId, req));
        assertEquals(HttpStatus.CONFLICT, ex.status());
        assertTrue(ex.getMessage().contains("dernier administrateur actif"));
    }

    @Test
    void cannotDemoteLastEnabledAdmin() {
        Long otherAdminId = 2L;
        AuthAccount otherAdmin = new AuthAccount(otherAdminId, "admin2@parking.local", "Admin 2", "h", true, Set.of(AuthRole.ADMIN), Instant.now());
        when(accountRepository.findById(otherAdminId)).thenReturn(Optional.of(otherAdmin));
        when(accountRepository.countEnabledAdmins()).thenReturn(1);

        AdminUpdateUserRequest req = new AdminUpdateUserRequest(null, null, List.of("AGENT"), null);
        AdminException ex = assertThrows(AdminException.class, () -> controller.updateUser(adminPrincipal, otherAdminId, req));
        assertEquals(HttpStatus.CONFLICT, ex.status());
        assertTrue(ex.getMessage().contains("dernier administrateur actif"));
    }

    @Test
    void invalidatesSessionsOnDisable() {
        Long targetId = 5L;
        String targetEmail = "driver@parking.local";
        AuthAccount target = new AuthAccount(targetId, targetEmail, "Driver", "h", true, Set.of(AuthRole.CONDUCTEUR), Instant.now());
        when(accountRepository.findById(targetId)).thenReturn(Optional.of(target));

        AuthAccount updated = new AuthAccount(targetId, targetEmail, "Driver", "h", false, Set.of(AuthRole.CONDUCTEUR), Instant.now());
        when(accountRepository.update(eq(targetId), isNull(), isNull(), eq(false), isNull())).thenReturn(updated);

        Map<String, Session> userSessions = Map.of("sess-1", new MapSession());
        doReturn(userSessions).when(sessionRepository).findByPrincipalName(targetEmail);

        AdminUpdateUserRequest req = new AdminUpdateUserRequest(false, null, null, null);
        ResponseEntity<AdminUserSummaryResponse> resp = controller.updateUser(adminPrincipal, targetId, req);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        verify(sessionRepository).deleteById("sess-1");
        verify(accountRepository).deleteSessionsByPrincipalName(targetEmail);
    }

    @Test
    void invalidatesSessionsOnRolesChange() {
        Long targetId = 5L;
        String targetEmail = "driver@parking.local";
        AuthAccount target = new AuthAccount(targetId, targetEmail, "Driver", "h", true, Set.of(AuthRole.CONDUCTEUR), Instant.now());
        when(accountRepository.findById(targetId)).thenReturn(Optional.of(target));

        AuthAccount updated = new AuthAccount(targetId, targetEmail, "Driver", "h", true, Set.of(AuthRole.AGENT), Instant.now());
        when(accountRepository.update(eq(targetId), isNull(), isNull(), isNull(), eq(Set.of(AuthRole.AGENT)))).thenReturn(updated);

        Map<String, Session> userSessions = Map.of("sess-2", new MapSession());
        doReturn(userSessions).when(sessionRepository).findByPrincipalName(targetEmail);

        AdminUpdateUserRequest req = new AdminUpdateUserRequest(null, null, List.of("AGENT"), null);
        ResponseEntity<AdminUserSummaryResponse> resp = controller.updateUser(adminPrincipal, targetId, req);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        verify(sessionRepository).deleteById("sess-2");
        verify(accountRepository).deleteSessionsByPrincipalName(targetEmail);
    }

    @Test
    void invalidatesSessionsOnPasswordReset() {
        Long targetId = 5L;
        String targetEmail = "driver@parking.local";
        AuthAccount target = new AuthAccount(targetId, targetEmail, "Driver", "h", true, Set.of(AuthRole.CONDUCTEUR), Instant.now());
        when(accountRepository.findById(targetId)).thenReturn(Optional.of(target));

        AuthAccount updated = new AuthAccount(targetId, targetEmail, "Driver", "new-hash", true, Set.of(AuthRole.CONDUCTEUR), Instant.now());
        when(accountRepository.update(eq(targetId), isNull(), anyString(), isNull(), isNull())).thenReturn(updated);

        Map<String, Session> userSessions = Map.of("sess-3", new MapSession());
        doReturn(userSessions).when(sessionRepository).findByPrincipalName(targetEmail);

        AdminUpdateUserRequest req = new AdminUpdateUserRequest(null, null, null, "NewSecurePassword2026!");
        ResponseEntity<AdminUserSummaryResponse> resp = controller.updateUser(adminPrincipal, targetId, req);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        verify(sessionRepository).deleteById("sess-3");
        verify(accountRepository).deleteSessionsByPrincipalName(targetEmail);
    }

    @Test
    void doesNotInvalidateSessionsOnDisplayNameChangeOnly() {
        Long targetId = 5L;
        String targetEmail = "driver@parking.local";
        AuthAccount target = new AuthAccount(targetId, targetEmail, "Driver", "h", true, Set.of(AuthRole.CONDUCTEUR), Instant.now());
        when(accountRepository.findById(targetId)).thenReturn(Optional.of(target));

        AuthAccount updated = new AuthAccount(targetId, targetEmail, "Driver Renamed", "h", true, Set.of(AuthRole.CONDUCTEUR), Instant.now());
        when(accountRepository.update(eq(targetId), eq("Driver Renamed"), isNull(), isNull(), isNull())).thenReturn(updated);

        AdminUpdateUserRequest req = new AdminUpdateUserRequest(null, "Driver Renamed", null, null);
        ResponseEntity<AdminUserSummaryResponse> resp = controller.updateUser(adminPrincipal, targetId, req);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        verify(sessionRepository, never()).deleteById(anyString());
        verify(accountRepository, never()).deleteSessionsByPrincipalName(anyString());
    }
}
