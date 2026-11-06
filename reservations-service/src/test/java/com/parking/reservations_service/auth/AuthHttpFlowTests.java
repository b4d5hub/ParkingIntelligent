package com.parking.reservations_service.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;
import java.util.Set;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@ActiveProfiles("auth")
@Import({AuthAccountConfiguration.class, AuthWebSecurityConfiguration.class})
class AuthHttpFlowTests {

    private static final String EMAIL = "driver@example.test";
    private static final String PASSWORD = "Phrase de test uniquement 2026";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @MockitoBean
    private JdbcAuthAccountRepository accountRepository;

    private String passwordHash;

    @BeforeEach
    void setUp() {
        passwordHash = passwordEncoder.encode(PASSWORD);
        when(accountRepository.findByEmail(EMAIL)).thenReturn(Optional.of(account(true)));
    }

    @Test
    void issuesCsrfTokenWithoutAuthenticatingOrReadingAccounts() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/csrf").secure(true))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")))
                .andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn();

        assertNotNull(result.getRequest().getSession(false));
        verifyNoInteractions(accountRepository);
    }

    @Test
    void rejectsAnonymousCurrentUserRequestWithoutRedirect() throws Exception {
        mockMvc.perform(get("/api/auth/me").secure(true))
                .andExpect(status().isUnauthorized())
                .andExpect(header().doesNotExist(HttpHeaders.LOCATION))
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
        verifyNoInteractions(accountRepository);
    }

    @Test
    void loginRenewsSessionAndReturnsOnlyPublicUserFields() throws Exception {
        CsrfSession csrf = csrfSession(null);
        String anonymousSessionId = csrf.session().getId();

        MvcResult result = login(csrf, PASSWORD)
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(header().doesNotExist(HttpHeaders.LOCATION))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")))
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$.userId").value("42"))
                .andExpect(jsonPath("$.displayName").value("Conducteur de test"))
                .andExpect(jsonPath("$.roles[0]").value("CONDUCTEUR"))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andReturn();

        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        assertNotNull(session);
        assertNotEquals(anonymousSessionId, session.getId());
        SecurityContext context = (SecurityContext) session.getAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        assertNotNull(context);
        ParkingUserPrincipal principal = assertInstanceOf(ParkingUserPrincipal.class,
                context.getAuthentication().getPrincipal());
        assertNull(principal.getPassword());
        assertNull(context.getAuthentication().getCredentials());
    }

    @Test
    void currentUserComesFromSessionAndIgnoresForgedIdentityHeaders() throws Exception {
        MockHttpSession session = authenticatedSession();

        mockMvc.perform(get("/api/auth/me").secure(true).session(session)
                        .header("X-User-Id", "999").header("X-Role", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("42"))
                .andExpect(jsonPath("$.roles.length()").value(1))
                .andExpect(jsonPath("$.roles[0]").value("CONDUCTEUR"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")));
    }

    @Test
    void loginWithoutCsrfIsRejectedBeforePasswordLookup() throws Exception {
        mockMvc.perform(post("/api/auth/login").secure(true)
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("email", EMAIL).param("password", PASSWORD))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        verifyNoInteractions(accountRepository);
    }

    @Test
    void loginWithWrongCsrfIsRejectedBeforePasswordLookup() throws Exception {
        CsrfSession csrf = csrfSession(null);

        mockMvc.perform(post("/api/auth/login").secure(true).session(csrf.session())
                        .header(csrf.headerName(), "invalid-token")
                        .param("email", EMAIL).param("password", PASSWORD))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        verifyNoInteractions(accountRepository);
    }

    @Test
    void csrfTokenFromAnotherSessionIsRejected() throws Exception {
        CsrfSession first = csrfSession(null);
        CsrfSession second = csrfSession(null);

        mockMvc.perform(post("/api/auth/login").secure(true).session(second.session())
                        .header(first.headerName(), first.token())
                        .param("email", EMAIL).param("password", PASSWORD))
                .andExpect(status().isForbidden());
        verifyNoInteractions(accountRepository);
    }

    @Test
    void credentialFailuresShareTheSameGenericJsonResponse() throws Exception {
        CsrfSession wrongPassword = csrfSession(null);
        String wrongBody = login(wrongPassword, "incorrect")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andReturn().getResponse().getContentAsString();

        when(accountRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
        String absentBody = login(csrfSession(null), PASSWORD)
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        when(accountRepository.findByEmail(EMAIL)).thenReturn(Optional.of(account(false)));
        String disabledBody = login(csrfSession(null), PASSWORD)
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        assertEquals(wrongBody, absentBody);
        assertEquals(wrongBody, disabledBody);
        mockMvc.perform(get("/api/auth/me").secure(true).session(wrongPassword.session()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void accountStorageFailureReturnsServiceUnavailable() throws Exception {
        when(accountRepository.findByEmail(EMAIL)).thenThrow(new DataAccessResourceFailureException("Test outage"));

        login(csrfSession(null), PASSWORD)
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_UNAVAILABLE"))
                .andExpect(jsonPath("$.message").value("Authentification indisponible"));
    }

    @Test
    void preLoginCsrfTokenCannotBeReusedForLogout() throws Exception {
        CsrfSession csrf = csrfSession(null);
        MvcResult login = login(csrf, PASSWORD).andExpect(status().isOk()).andReturn();
        MockHttpSession session = (MockHttpSession) login.getRequest().getSession(false);

        mockMvc.perform(post("/api/auth/logout").secure(true).session(session)
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isForbidden());
    }

    @Test
    void logoutRequiresCsrfAndDoesNotInvalidateSessionOnFailure() throws Exception {
        MockHttpSession session = authenticatedSession();

        mockMvc.perform(post("/api/auth/logout").secure(true).session(session))
                .andExpect(status().isForbidden());
        assertFalse(session.isInvalid());
        mockMvc.perform(get("/api/auth/me").secure(true).session(session))
                .andExpect(status().isOk());
    }

    @Test
    void logoutInvalidatesSessionAndClearsCookie() throws Exception {
        MockHttpSession session = authenticatedSession();
        CsrfSession csrf = csrfSession(session);

        mockMvc.perform(post("/api/auth/logout").secure(true).session(session)
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNoContent())
                .andExpect(cookie().maxAge("PARKING_SESSION", 0))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")));

        assertTrue(session.isInvalid());
        mockMvc.perform(get("/api/auth/me").secure(true))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getLogoutDoesNotLogOutOrDisplayHtml() throws Exception {
        MockHttpSession session = authenticatedSession();

        mockMvc.perform(get("/api/auth/logout").secure(true).session(session))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
        assertFalse(session.isInvalid());
    }

    @Test
    void authenticationDoesNotOpenReservationRoutesBeforeOwnershipChecksExist() throws Exception {
        MockHttpSession session = authenticatedSession();

        mockMvc.perform(get("/api/reservations").secure(true).session(session))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    private AuthAccount account(boolean enabled) {
        return new AuthAccount(42L, EMAIL, "Conducteur de test", passwordHash,
                enabled, Set.of(AuthRole.CONDUCTEUR));
    }

    private CsrfSession csrfSession(MockHttpSession session) throws Exception {
        var request = get("/api/auth/csrf").secure(true);
        if (session != null) {
            request.session(session);
        }
        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        var json = objectMapper.readTree(result.getResponse().getContentAsString());
        return new CsrfSession((MockHttpSession) result.getRequest().getSession(false),
                json.get("headerName").asString(), json.get("token").asString());
    }

    private org.springframework.test.web.servlet.ResultActions login(CsrfSession csrf, String rawPassword)
            throws Exception {
        return mockMvc.perform(post("/api/auth/login").secure(true).session(csrf.session())
                .with(request -> {
                    // Simuler le cookie de session valide presente par le navigateur.
                    request.setRequestedSessionId(csrf.session().getId());
                    request.setRequestedSessionIdValid(true);
                    request.setRequestedSessionIdFromCookie(true);
                    return request;
                })
                .header(csrf.headerName(), csrf.token())
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .param("email", EMAIL).param("password", rawPassword));
    }

    private MockHttpSession authenticatedSession() throws Exception {
        MvcResult result = login(csrfSession(null), PASSWORD).andExpect(status().isOk()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private record CsrfSession(MockHttpSession session, String headerName, String token) {
    }
}
