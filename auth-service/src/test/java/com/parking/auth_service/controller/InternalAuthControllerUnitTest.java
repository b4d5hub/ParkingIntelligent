package com.parking.auth_service.controller;

import com.parking.auth_service.model.AuthAccount;
import com.parking.auth_service.model.AuthRole;
import com.parking.auth_service.repository.JdbcAuthAccountRepository;
import com.parking.auth_service.security.AuthSessionPolicy;
import com.parking.auth_service.security.ParkingUserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.DefaultCsrfToken;
import org.springframework.session.MapSession;
import org.springframework.session.MapSessionRepository;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class InternalAuthControllerUnitTest {

    private final JdbcAuthAccountRepository accountRepository = mock(JdbcAuthAccountRepository.class);
    private final MapSessionRepository sessionRepository = new MapSessionRepository(new ConcurrentHashMap<>());
    private final Clock clock = Clock.systemUTC();
    private final PasswordEncoder encoder = new DelegatingPasswordEncoder("argon2",
            Map.of("argon2", new Argon2PasswordEncoder(16, 32, 1, 19456, 2)));
    private AuthSessionPolicy policy;
    private InternalAuthController controller;

    private String sessionId;
    private final String csrfHeader = "X-CSRF-TOKEN";
    private final String csrfToken = "valid-csrf-token-123";

    @BeforeEach
    void setUp() {
        policy = new AuthSessionPolicy(accountRepository, clock, Duration.ofHours(8), new ObjectMapper());
        controller = new InternalAuthController(sessionRepository, policy, clock);

        String rawPassword = "password-test-2026";
        String encoded = encoder.encode(rawPassword);
        AuthAccount account = new AuthAccount(1L, "driver@test.local", "Driver Test", encoded, true, Set.of(AuthRole.CONDUCTEUR));
        ParkingUserPrincipal principal = new ParkingUserPrincipal(account);

        when(accountRepository.findByEmail("driver@test.local")).thenReturn(Optional.of(account));

        MapSession session = sessionRepository.createSession();
        sessionId = session.getId();
        SecurityContextImpl context = new SecurityContextImpl(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        session.setAttribute(AuthSessionPolicy.AUTHENTICATED_AT, clock.millis());
        session.setAttribute("PARKING_CSRF", new DefaultCsrfToken(csrfHeader, "_csrf", csrfToken));
        sessionRepository.save(session);
    }

    @Test
    void validatesActiveSessionForGatewayEndpoint() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        var body = new InternalAuthController.ValidationRequest(sessionId, "GET", null);

        ResponseEntity<?> response = controller.validateGateway(body, request);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        var user = (com.parking.auth_service.dto.AuthUserResponse) response.getBody();
        assertNotNull(user);
        assertEquals("1", user.userId());
        assertEquals("Driver Test", user.displayName());
        assertTrue(user.roles().contains("CONDUCTEUR"));
    }

    @Test
    void validatesActiveSessionForGetRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        var body = new InternalAuthController.ValidationRequest(sessionId, "GET", null);

        ResponseEntity<?> response = controller.validate(body, request);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        var res = (InternalAuthController.ValidationResponse) response.getBody();
        assertNotNull(res);
        assertEquals("1", res.user().userId());
        assertEquals("Driver Test", res.user().displayName());
        assertTrue(res.user().roles().contains("CONDUCTEUR"));
    }

    @Test
    void validatesActiveSessionForPostRequestWithValidCsrf() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        var body = new InternalAuthController.ValidationRequest(sessionId, "POST", csrfToken);

        ResponseEntity<?> response = controller.validate(body, request);
        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    @Test
    void rejectsPostRequestWithMissingCsrf() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        var body = new InternalAuthController.ValidationRequest(sessionId, "POST", null);

        InternalAuthController.AuthException ex = assertThrows(
                InternalAuthController.AuthException.class,
                () -> controller.validate(body, request)
        );
        assertEquals(HttpStatus.FORBIDDEN, ex.status());
        assertEquals("CSRF_INVALID", ex.code());
    }

    @Test
    void rejectsPostRequestWithInvalidCsrf() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        var body = new InternalAuthController.ValidationRequest(sessionId, "POST", "wrong-csrf");

        InternalAuthController.AuthException ex = assertThrows(
                InternalAuthController.AuthException.class,
                () -> controller.validate(body, request)
        );
        assertEquals(HttpStatus.FORBIDDEN, ex.status());
        assertEquals("CSRF_INVALID", ex.code());
    }

    @Test
    void rejectsNonExistentSession() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        var body = new InternalAuthController.ValidationRequest(UUID.randomUUID().toString(), "GET", null);

        InternalAuthController.AuthException ex = assertThrows(
                InternalAuthController.AuthException.class,
                () -> controller.validate(body, request)
        );
        assertEquals(HttpStatus.UNAUTHORIZED, ex.status());
        assertEquals("AUTHENTICATION_REQUIRED", ex.code());
    }

    @Test
    void rejectsInvalidHttpMethod() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        var body = new InternalAuthController.ValidationRequest(sessionId, "INVALID", null);

        InternalAuthController.AuthException ex = assertThrows(
                InternalAuthController.AuthException.class,
                () -> controller.validate(body, request)
        );
        assertEquals(HttpStatus.BAD_REQUEST, ex.status());
        assertEquals("INVALID_REQUEST", ex.code());
    }
}
