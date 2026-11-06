package com.parking.reservations_service.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthAccountAuthenticationTests {

    private final JdbcAuthAccountRepository accountRepository = mock(JdbcAuthAccountRepository.class);
    private final PasswordEncoder passwordEncoder = new AuthAccountConfiguration().passwordEncoder();
    private final String email = "driver@example.test";
    private final String password = "Phrase de test uniquement 2026";
    private ProviderManager authenticationManager;

    @BeforeEach
    void setUp() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(
                new ParkingUserDetailsService(accountRepository));
        provider.setPasswordEncoder(passwordEncoder);
        authenticationManager = new ProviderManager(provider);
    }

    @Test
    void authenticatesStoredAccountAndErasesCredentials() {
        when(accountRepository.findByEmail(email)).thenReturn(Optional.of(account(true, Set.of(AuthRole.CONDUCTEUR))));

        Authentication authentication = authenticate(email, password);

        assertTrue(authentication.isAuthenticated());
        ParkingUserPrincipal principal = assertInstanceOf(ParkingUserPrincipal.class, authentication.getPrincipal());
        assertEquals(42L, principal.getUserId());
        assertEquals("Conducteur de test", principal.getDisplayName());
        assertTrue(authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_CONDUCTEUR")));
        assertFalse(authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN")));
        assertNull(authentication.getCredentials());
        assertNull(principal.getPassword());
    }

    @Test
    void rejectsWrongPassword() {
        when(accountRepository.findByEmail(email)).thenReturn(Optional.of(account(true, Set.of(AuthRole.CONDUCTEUR))));

        assertThrows(BadCredentialsException.class, () -> authenticate(email, "incorrect"));
    }

    @Test
    void rejectsUnknownAccountWithGenericCredentialFailure() {
        when(accountRepository.findByEmail(email)).thenReturn(Optional.empty());

        assertThrows(BadCredentialsException.class, () -> authenticate(email, password));
    }

    @Test
    void rejectsDisabledAccount() {
        when(accountRepository.findByEmail(email)).thenReturn(Optional.of(account(false, Set.of(AuthRole.CONDUCTEUR))));

        assertThrows(DisabledException.class, () -> authenticate(email, password));
    }

    @Test
    void rejectsAccountWithoutAssignedRole() {
        when(accountRepository.findByEmail(email)).thenReturn(Optional.of(account(true, Set.of())));

        assertThrows(BadCredentialsException.class, () -> authenticate(email, password));
    }

    @Test
    void stripsSurroundingWhitespaceFromLogin() {
        when(accountRepository.findByEmail(email)).thenReturn(Optional.of(account(true, Set.of(AuthRole.AGENT))));

        Authentication authentication = authenticate("  " + email + "  ", password);

        assertEquals(email, authentication.getName());
        verify(accountRepository).findByEmail(email);
    }

    @Test
    void rejectsBlankLoginBeforeDatabaseAccess() {
        assertThrows(BadCredentialsException.class, () -> authenticate("   ", password));
        verifyNoInteractions(accountRepository);
    }

    @Test
    void failsClosedWhenAccountStorageIsUnavailable() {
        when(accountRepository.findByEmail(email)).thenThrow(new DataAccessResourceFailureException("Storage unavailable"));

        assertThrows(InternalAuthenticationServiceException.class, () -> authenticate(email, password));
    }

    private Authentication authenticate(String login, String rawPassword) {
        return authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(login, rawPassword));
    }

    private AuthAccount account(boolean enabled, Set<AuthRole> roles) {
        return new AuthAccount(42L, email, "Conducteur de test", passwordEncoder.encode(password), enabled, roles);
    }
}
