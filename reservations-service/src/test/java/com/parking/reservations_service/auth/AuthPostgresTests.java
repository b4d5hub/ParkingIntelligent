package com.parking.reservations_service.auth;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.*;
import org.springframework.session.*;
import tools.jackson.databind.ObjectMapper;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "server.address=127.0.0.1", "server.servlet.session.cookie.secure=false", "parking.sync.enabled=false", "parking.no-show-grace="})
@ActiveProfiles("auth")
@EnabledIfEnvironmentVariable(named = "PARKING_INTEGRATION", matches = "true")
class AuthPostgresTests {
    static final String PASSWORD = "Une phrase de test locale seulement 2026";
    static final String MACHINE_SECRET = "machine-test-local-uniquement-2026";
    static final String MACHINE_HASH = "{argon2}" + new Argon2PasswordEncoder(16, 32, 1, 19456, 2).encode(MACHINE_SECRET);
    @DynamicPropertySource static void machine(DynamicPropertyRegistry registry) {
        registry.add("parking.auth.clients.places.username", () -> "test-places");
        registry.add("parking.auth.clients.places.password-hash", () -> MACHINE_HASH);
    }
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired ObjectMapper mapper;
    @Autowired SessionRepository<? extends Session> sessions;
    CookieManager cookies;
    HttpClient browser;
    String email;
    long userId;
    @BeforeEach void setup() {
        cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        browser = HttpClient.newBuilder().cookieHandler(cookies).connectTimeout(Duration.ofSeconds(3)).build();
        email = UUID.randomUUID() + "@example.test";
        userId = jdbc.queryForObject("insert into parking_auth_users(email,display_name,password_hash,enabled) values (?, 'Test', ?, true) returning id", Long.class, email, encoder.encode(PASSWORD));
        jdbc.update("insert into parking_auth_user_roles(user_id,role) values (?, 'CONDUCTEUR')", userId);
    }
    URI uri(String path) { return URI.create("http://127.0.0.1:" + port + path); }
    HttpResponse<String> get(String path) throws Exception {
        return browser.send(HttpRequest.newBuilder(uri(path)).timeout(Duration.ofSeconds(5)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }
    String token() throws Exception {
        var response = get("/api/auth/csrf"); assertEquals(200, response.statusCode());
        return mapper.readTree(response.body()).get("token").asText();
    }
    String sessionId() { return cookies.getCookieStore().getCookies().stream().filter(cookie -> cookie.getName().equals("PARKING_SESSION")).findFirst().orElseThrow().getValue(); }
    void login() throws Exception {
        String token = token(); String previous = sessionId();
        var request = HttpRequest.newBuilder(uri("/api/auth/login")).timeout(Duration.ofSeconds(5))
            .header("Content-Type", "application/x-www-form-urlencoded").header("X-CSRF-TOKEN", token)
            .POST(HttpRequest.BodyPublishers.ofString("email=" + URLEncoder.encode(email, StandardCharsets.UTF_8)
                + "&password=" + URLEncoder.encode(PASSWORD, StandardCharsets.UTF_8))).build();
        var result = browser.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, result.statusCode(), result.body()); assertNotEquals(previous, sessionId());
    }
    HttpResponse<String> internal(String method, String token, boolean authorized) throws Exception {
        var request = HttpRequest.newBuilder(uri("/internal/auth/validate-user-request"))
            .header("Content-Type", "application/json");
        if (authorized) { request.header("Authorization", "Basic " + Base64.getEncoder().encodeToString(("test-places:" + MACHINE_SECRET).getBytes(StandardCharsets.UTF_8))); }
        return HttpClient.newHttpClient().send(request.POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(
            new InternalAuthController.ValidationRequest(sessionId(), method, token)))).build(), HttpResponse.BodyHandlers.ofString());
    }
    @Test void sessionPersistsInPostgresAndLogoutInvalidatesItsCookie() throws Exception {
        login(); String id = sessionId();
        assertEquals(1, jdbc.queryForObject("select count(*) from spring_session where session_id = ?", Integer.class, id));
        var freshBrowser = HttpClient.newHttpClient();
        var request = HttpRequest.newBuilder(uri("/api/auth/me")).header("Cookie", "PARKING_SESSION=" + id).GET().build();
        assertEquals(200, freshBrowser.send(request, HttpResponse.BodyHandlers.ofString()).statusCode());
        var logout = HttpRequest.newBuilder(uri("/api/auth/logout")).header("X-CSRF-TOKEN", token()).POST(HttpRequest.BodyPublishers.noBody()).build();
        assertEquals(204, browser.send(logout, HttpResponse.BodyHandlers.ofString()).statusCode());
        assertEquals(401, freshBrowser.send(request, HttpResponse.BodyHandlers.ofString()).statusCode());
        assertEquals(0, jdbc.queryForObject("select count(*) from spring_session where session_id = ?", Integer.class, id));
    }
    @Test void disabledAccountRevokesAnExistingSession() throws Exception {
        login(); jdbc.update("update parking_auth_users set enabled=false where id=?", userId);
        assertEquals(401, get("/api/auth/me").statusCode());
    }
    @Test void removedRoleRevokesAnExistingSession() throws Exception {
        login(); jdbc.update("delete from parking_auth_user_roles where user_id=?", userId);
        assertEquals(401, get("/api/reservations/me").statusCode());
    }
    @Test void changedPasswordRevokesAnExistingSession() throws Exception {
        login(); jdbc.update("update parking_auth_users set password_hash=? where id=?", encoder.encode(PASSWORD + " changed"), userId);
        assertEquals(401, get("/api/auth/me").statusCode());
    }
    @Test void absoluteTimeoutRevokesAnOtherwiseActiveSession() throws Exception {
        login(); ageSession(sessions);
        assertEquals(401, get("/api/auth/me").statusCode());
    }
    private <S extends Session> void ageSession(SessionRepository<S> repository) {
        S session = repository.findById(sessionId());
        session.setAttribute(AuthSessionPolicy.AUTHENTICATED_AT, System.currentTimeMillis() - Duration.ofHours(8).toMillis());
        repository.save(session);
    }
    @Test void inactivityTimeoutRejectsAnOldCookie() throws Exception {
        login(); long old = System.currentTimeMillis() - Duration.ofHours(1).toMillis();
        jdbc.update("update spring_session set last_access_time=?, expiry_time=? where session_id=?", old, old, sessionId());
        assertEquals(401, get("/api/auth/me").statusCode());
    }
    @Test void repeatedLoginAttemptsAreTemporarilyLimited() throws Exception {
        String token = token();
        for (int attempt = 1; attempt <= 11; attempt++) {
            var request = HttpRequest.newBuilder(uri("/api/auth/login")).header("Content-Type", "application/x-www-form-urlencoded")
                .header("X-CSRF-TOKEN", token).POST(HttpRequest.BodyPublishers.ofString("email=" + URLEncoder.encode(email, StandardCharsets.UTF_8) + "&password=wrong")).build();
            assertEquals(attempt <= 10 ? 401 : 429, browser.send(request, HttpResponse.BodyHandlers.ofString()).statusCode());
        }
    }
    @Test void internalValidationRequiresMachineCredentialsAndUserCsrfForChanges() throws Exception {
        login();
        assertEquals(401, internal("GET", null, false).statusCode());
        assertEquals(200, internal("GET", null, true).statusCode());
        assertEquals(403, internal("POST", null, true).statusCode());
        assertEquals(403, internal("POST", "wrong", true).statusCode());
        var validated = internal("POST", token(), true);
        assertEquals(200, validated.statusCode(), validated.body());
        assertEquals(Long.toString(userId), mapper.readTree(validated.body()).get("user").get("userId").asText());
        jdbc.update("update parking_auth_users set enabled=false where id=?", userId);
        assertEquals(401, internal("GET", null, true).statusCode());
    }
}
