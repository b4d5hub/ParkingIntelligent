package com.parking.auth_service.security;

import com.parking.auth_service.dto.AuthErrorResponse;
import com.parking.auth_service.repository.JdbcAuthAccountRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.dao.DataAccessException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/** Recheck current rights and password stamp; old sessions never keep removed rights. */
public class AuthSessionPolicy extends OncePerRequestFilter {
    public static final String AUTHENTICATED_AT = "PARKING_AUTHENTICATED_AT";
    private final JdbcAuthAccountRepository accounts;
    private final Clock clock;
    private final Duration absolute;
    private final ObjectMapper mapper;

    public AuthSessionPolicy(JdbcAuthAccountRepository accounts, Clock clock, Duration absolute, ObjectMapper mapper) {
        this.accounts = accounts;
        this.clock = clock;
        this.absolute = absolute;
        this.mapper = mapper;
    }

    public void initialize(HttpSession session) {
        session.setAttribute(AUTHENTICATED_AT, clock.millis());
    }

    public boolean valid(ParkingUserPrincipal principal, Object authenticatedAt) {
        if (!(authenticatedAt instanceof Long time) || time > clock.millis()
                || !Instant.ofEpochMilli(time).plus(absolute).isAfter(clock.instant())) {
            return false;
        }
        return accounts.findByEmail(principal.getUsername()).filter(account -> account.enabled()
                && account.id().equals(principal.getUserId())
                && principal.getCredentialStamp().equals(ParkingUserPrincipal.credentialStamp(account.passwordHash()))
                && principal.getAuthorities().equals(new ParkingUserPrincipal(account).getAuthorities())).isPresent();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        response.setHeader("Cache-Control", "no-store");
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof ParkingUserPrincipal principal) {
            var session = request.getSession(false);
            try {
                if (session == null || !valid(principal, session.getAttribute(AUTHENTICATED_AT))) {
                    if (session != null) {
                        session.invalidate();
                    }
                    SecurityContextHolder.clearContext();
                    error(response, 401, "SESSION_REVOKED", "Session expirée ou révoquée");
                    return;
                }
            } catch (DataAccessException exception) {
                error(response, 503, "AUTHENTICATION_UNAVAILABLE", "Authentification indisponible");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private void error(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-store");
        mapper.writeValue(response.getOutputStream(), new AuthErrorResponse(code, message));
    }
}
