package com.parking.auth_service.controller;

import com.parking.auth_service.dto.AuthErrorResponse;
import com.parking.auth_service.dto.AuthUserResponse;
import com.parking.auth_service.security.AuthSessionPolicy;
import com.parking.auth_service.security.ParkingUserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.Set;

@RestController
@RequestMapping("/internal/auth")
public class InternalAuthController {

    private final SessionRepository<? extends Session> sessions;
    private final AuthSessionPolicy policy;
    private final Clock clock;

    public InternalAuthController(SessionRepository<? extends Session> sessions, AuthSessionPolicy policy, Clock clock) {
        this.sessions = sessions;
        this.policy = policy;
        this.clock = clock;
    }

    @PostMapping("/validate-user-request")
    public ResponseEntity<?> validate(@Valid @RequestBody ValidationRequest body, HttpServletRequest request) {
        return validateSession(sessions, body, request);
    }

    @PostMapping("/validate")
    public ResponseEntity<?> validateGateway(@Valid @RequestBody ValidationRequest body, HttpServletRequest request) {
        ResponseEntity<?> response = validateSession(sessions, body, request);
        if (response.getBody() instanceof ValidationResponse val) {
            return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(val.user());
        }
        return response;
    }

    private <S extends Session> ResponseEntity<?> validateSession(SessionRepository<S> repository, ValidationRequest body, HttpServletRequest request) {
        if (!Set.of("GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE").contains(body.httpMethod())) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Méthode HTTP invalide");
        }
        S session = repository.findById(body.sessionCookie());
        if (session == null || session.isExpired()) {
            throw unauthorized();
        }
        Object stored = session.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        if (!(stored instanceof SecurityContext context) || context.getAuthentication() == null
                || !(context.getAuthentication().getPrincipal() instanceof ParkingUserPrincipal principal)
                || !policy.valid(principal, session.getAttribute(AuthSessionPolicy.AUTHENTICATED_AT))) {
            repository.deleteById(session.getId());
            throw unauthorized();
        }
        if (!Set.of("GET", "HEAD", "OPTIONS").contains(body.httpMethod())) {
            CsrfToken token = session.getAttribute("PARKING_CSRF");
            if (token == null || body.csrfToken() == null) {
                throw csrfFailure();
            }
            var wrapper = new HttpServletRequestWrapper(request) {
                @Override
                public String getHeader(String name) {
                    return token.getHeaderName().equalsIgnoreCase(name) ? body.csrfToken() : null;
                }

                @Override
                public String getParameter(String name) {
                    return null;
                }
            };
            String resolved = new XorCsrfTokenRequestAttributeHandler().resolveCsrfTokenValue(wrapper, token);
            if (resolved == null || !MessageDigest.isEqual(token.getToken().getBytes(StandardCharsets.UTF_8), resolved.getBytes(StandardCharsets.UTF_8))) {
                throw csrfFailure();
            }
        }
        session.setLastAccessedTime(clock.instant());
        repository.save(session);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new ValidationResponse(
                AuthUserResponse.fromPrincipal(principal), Instant.ofEpochMilli(session.getAttribute(AuthSessionPolicy.AUTHENTICATED_AT))));
    }

    private AuthException unauthorized() {
        return new AuthException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED", "Session absente, expirée ou révoquée");
    }

    private AuthException csrfFailure() {
        return new AuthException(HttpStatus.FORBIDDEN, "CSRF_INVALID", "Jeton CSRF absent ou invalide");
    }

    @ExceptionHandler(AuthException.class)
    ResponseEntity<?> failure(AuthException failure) {
        return ResponseEntity.status(failure.status()).cacheControl(CacheControl.noStore())
                .body(new AuthErrorResponse(failure.code(), failure.getMessage()));
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> unavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).cacheControl(CacheControl.noStore())
                .body(new AuthErrorResponse("AUTHENTICATION_UNAVAILABLE", "Authentification indisponible"));
    }

    public record ValidationRequest(
            @NotBlank @Pattern(regexp = "[0-9a-fA-F-]{36}") String sessionCookie,
            @NotBlank @Size(max = 7) String httpMethod,
            @Size(max = 1024) String csrfToken) {
        @Override
        public String toString() {
            return "ValidationRequest[redacted]";
        }
    }

    public record ValidationResponse(AuthUserResponse user, Instant authenticatedAt) {
    }

    public static class AuthException extends RuntimeException {
        private final HttpStatus status;
        private final String code;

        public AuthException(HttpStatus status, String code, String message) {
            super(message);
            this.status = status;
            this.code = code;
        }

        public HttpStatus status() {
            return status;
        }

        public String code() {
            return code;
        }
    }
}
