package com.parking.reservations_service.auth;

import com.parking.reservations_service.service.ReservationFailure;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.*;
import org.springframework.session.*;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.Set;

@RestController
@Profile("auth")
@RequestMapping("/internal/auth")
public class InternalAuthController {
    private final SessionRepository<? extends Session> sessions;
    private final AuthSessionPolicy policy;
    private final Clock clock;
    public InternalAuthController(SessionRepository<? extends Session> sessions, AuthSessionPolicy policy, Clock clock) {
        this.sessions = sessions; this.policy = policy; this.clock = clock;
    }
    @PostMapping("/validate-user-request")
    public ResponseEntity<?> validate(@Valid @RequestBody ValidationRequest body, HttpServletRequest request) {
        return validateSession(sessions, body, request);
    }
    private <S extends Session> ResponseEntity<?> validateSession(SessionRepository<S> repository, ValidationRequest body, HttpServletRequest request) {
        if (!Set.of("GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE").contains(body.httpMethod())) {
            throw new ReservationFailure(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Méthode HTTP invalide");
        }
        S session = repository.findById(body.sessionCookie());
        if (session == null || session.isExpired()) { throw unauthorized(); }
        Object stored = session.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        if (!(stored instanceof SecurityContext context) || context.getAuthentication() == null
                || !(context.getAuthentication().getPrincipal() instanceof ParkingUserPrincipal principal)
                || !policy.valid(principal, session.getAttribute(AuthSessionPolicy.AUTHENTICATED_AT))) {
            repository.deleteById(session.getId()); throw unauthorized();
        }
        if (!Set.of("GET", "HEAD", "OPTIONS").contains(body.httpMethod())) {
            CsrfToken token = session.getAttribute("PARKING_CSRF");
            if (token == null || body.csrfToken() == null) { throw csrfFailure(); }
            var wrapper = new HttpServletRequestWrapper(request) {
                @Override public String getHeader(String name) { return token.getHeaderName().equalsIgnoreCase(name) ? body.csrfToken() : null; }
                @Override public String getParameter(String name) { return null; }
            };
            String resolved = new XorCsrfTokenRequestAttributeHandler().resolveCsrfTokenValue(wrapper, token);
            if (resolved == null || !MessageDigest.isEqual(token.getToken().getBytes(StandardCharsets.UTF_8), resolved.getBytes(StandardCharsets.UTF_8))) {
                throw csrfFailure();
            }
        }
        session.setLastAccessedTime(clock.instant()); repository.save(session);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new ValidationResponse(
                AuthUserResponse.fromPrincipal(principal), Instant.ofEpochMilli(session.getAttribute(AuthSessionPolicy.AUTHENTICATED_AT))));
    }
    private ReservationFailure unauthorized() { return new ReservationFailure(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED", "Session absente, expirée ou révoquée"); }
    private ReservationFailure csrfFailure() { return new ReservationFailure(HttpStatus.FORBIDDEN, "CSRF_INVALID", "Jeton CSRF absent ou invalide"); }
    @ExceptionHandler(ReservationFailure.class)
    ResponseEntity<?> failure(ReservationFailure failure) { return ResponseEntity.status(failure.status()).cacheControl(CacheControl.noStore()).body(new AuthErrorResponse(failure.code(), failure.getMessage())); }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> unavailable() { return ResponseEntity.status(503).cacheControl(CacheControl.noStore()).body(new AuthErrorResponse("AUTHENTICATION_UNAVAILABLE", "Authentification indisponible")); }
    public record ValidationRequest(@NotBlank @Pattern(regexp="[0-9a-fA-F-]{36}") String sessionCookie,
            @NotBlank @Size(max=7) String httpMethod, @Size(max=1024) String csrfToken) {
        @Override public String toString() { return "ValidationRequest[redacted]"; }
    }
    public record ValidationResponse(AuthUserResponse user, Instant authenticatedAt) { }
}
