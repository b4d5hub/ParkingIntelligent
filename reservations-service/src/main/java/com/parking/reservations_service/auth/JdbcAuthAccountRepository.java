package com.parking.reservations_service.auth;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;

public class JdbcAuthAccountRepository {

    private static final String FIND_BY_EMAIL = """
            SELECT u.id, u.email, u.display_name, u.password_hash, u.enabled, r.role
            FROM public.parking_auth_users u
            LEFT JOIN public.parking_auth_user_roles r ON r.user_id = u.id
            WHERE lower(u.email) = lower(?)
            ORDER BY r.role
            """;

    private final JdbcTemplate jdbcTemplate;

    public JdbcAuthAccountRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<AuthAccount> findByEmail(String email) {
        return jdbcTemplate.query(FIND_BY_EMAIL, result -> {
            if (!result.next()) {
                return Optional.empty();
            }

            Long id = result.getLong("id");
            String storedEmail = result.getString("email");
            String displayName = result.getString("display_name");
            String passwordHash = result.getString("password_hash");
            boolean enabled = result.getBoolean("enabled");
            Set<AuthRole> roles = EnumSet.noneOf(AuthRole.class);

            do {
                String role = result.getString("role");
                if (role != null) {
                    roles.add(AuthRole.valueOf(role));
                }
            } while (result.next());

            return Optional.of(new AuthAccount(id, storedEmail, displayName, passwordHash, enabled, roles));
        }, email);
    }
}
