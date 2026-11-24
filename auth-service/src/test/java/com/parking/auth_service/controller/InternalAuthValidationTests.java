package com.parking.auth_service.controller;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "parking.auth.clients.places.username=test-places",
        "parking.auth.clients.places.password-hash={argon2}$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$e6Yx9N3PZ4d6e9q1M3b4mZ9h7v4j1a9u2k6l8x7z5q1",
        "server.servlet.session.cookie.secure=false"
})
class InternalAuthValidationTests {

    @LocalServerPort
    private int port;

    private final HttpClient client = HttpClient.newHttpClient();

    private String url() {
        return "http://localhost:" + port + "/internal/auth/validate-user-request";
    }

    @Test
    void rejectsUnauthenticatedMachineCaller() throws Exception {
        String json = "{\"sessionCookie\":\"" + UUID.randomUUID() + "\",\"httpMethod\":\"GET\"}";
        HttpRequest request = HttpRequest.newBuilder(URI.create(url()))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(401, response.statusCode());
        assertTrue(response.body().contains("INVALID_SERVICE_CREDENTIALS"));
    }

    @Test
    void rejectsInvalidMachineCredentials() throws Exception {
        String authHeader = "Basic " + Base64.getEncoder().encodeToString("wrong:wrong".getBytes(StandardCharsets.UTF_8));
        String json = "{\"sessionCookie\":\"" + UUID.randomUUID() + "\",\"httpMethod\":\"GET\"}";
        HttpRequest request = HttpRequest.newBuilder(URI.create(url()))
                .header("Content-Type", "application/json")
                .header("Authorization", authHeader)
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(401, response.statusCode());
        assertTrue(response.body().contains("INVALID_SERVICE_CREDENTIALS"));
    }
}
