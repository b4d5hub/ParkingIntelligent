package com.parking.reservations_service.auth;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.Clock;
import java.util.*;

/** Bounded, temporary limits for the prototype's single authentication instance. */
public class AuthLoginThrottle extends OncePerRequestFilter {
    private final Map<String, Window> windows = new LinkedHashMap<>();
    private final Clock clock;
    private final int accountLimit;
    private final int addressLimit;
    private final ObjectMapper mapper;
    private static final long WINDOW_MS = 300_000;
    public AuthLoginThrottle(Clock clock, int accountLimit, int addressLimit, ObjectMapper mapper) {
        if (accountLimit < 1 || addressLimit < 1) { throw new IllegalArgumentException("Invalid login limit"); }
        this.clock = clock; this.accountLimit = accountLimit; this.addressLimit = addressLimit; this.mapper = mapper;
    }
    synchronized boolean allow(String email, String address) {
        long now = clock.millis();
        windows.entrySet().removeIf(entry -> entry.getValue().until <= now);
        String account = "account:" + email.strip().toLowerCase(Locale.ROOT);
        String source = "source:" + address;
        if (count(account) >= accountLimit || count(source) >= addressLimit) { return false; }
        add(account, now); add(source, now);
        while (windows.size() > 10_000) { windows.remove(windows.keySet().iterator().next()); }
        return true;
    }
    private int count(String key) { return windows.containsKey(key) ? windows.get(key).count : 0; }
    private void add(String key, long now) { windows.compute(key, (name, previous) -> previous == null ? new Window(1, now + WINDOW_MS) : new Window(previous.count + 1, previous.until)); }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws IOException, ServletException {
        if ("POST".equals(request.getMethod()) && "/api/auth/login".equals(request.getServletPath())) {
            String email = Objects.toString(request.getParameter("email"), "");
            String password = Objects.toString(request.getParameter("password"), "");
            if (email.length() > 254 || password.length() > 1024 || !allow(email, request.getRemoteAddr())) {
                response.setStatus(429); response.setHeader("Retry-After", "300"); response.setHeader("Cache-Control", "no-store");
                response.setContentType("application/json"); response.setCharacterEncoding("UTF-8");
                mapper.writeValue(response.getOutputStream(), new AuthErrorResponse("LOGIN_RATE_LIMITED", "Réessayez plus tard")); return;
            }
        }
        chain.doFilter(request, response);
    }
    private record Window(int count, long until) { }
}
