package com.parking.auth_service.repository;

import com.parking.auth_service.model.AuthAccount;
import com.parking.auth_service.model.AuthRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Repository
public class JdbcAuthAccountRepository {

    private static final String FIND_BY_EMAIL = """
            SELECT u.id, u.email, u.display_name, u.password_hash, u.enabled, u.created_at, r.role
            FROM public.parking_auth_users u
            LEFT JOIN public.parking_auth_user_roles r ON r.user_id = u.id
            WHERE lower(u.email) = lower(?)
            ORDER BY r.role
            """;

    private static final String FIND_BY_ID = """
            SELECT u.id, u.email, u.display_name, u.password_hash, u.enabled, u.created_at, r.role
            FROM public.parking_auth_users u
            LEFT JOIN public.parking_auth_user_roles r ON r.user_id = u.id
            WHERE u.id = ?
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
            Timestamp createdAtTs = result.getTimestamp("created_at");
            Instant createdAt = createdAtTs != null ? createdAtTs.toInstant() : Instant.now();
            Set<AuthRole> roles = EnumSet.noneOf(AuthRole.class);

            do {
                String role = result.getString("role");
                if (role != null) {
                    roles.add(AuthRole.valueOf(role));
                }
            } while (result.next());

            return Optional.of(new AuthAccount(id, storedEmail, displayName, passwordHash, enabled, roles, createdAt));
        }, email);
    }

    public Optional<AuthAccount> findById(Long id) {
        return jdbcTemplate.query(FIND_BY_ID, result -> {
            if (!result.next()) {
                return Optional.empty();
            }

            Long userId = result.getLong("id");
            String storedEmail = result.getString("email");
            String displayName = result.getString("display_name");
            String passwordHash = result.getString("password_hash");
            boolean enabled = result.getBoolean("enabled");
            Timestamp createdAtTs = result.getTimestamp("created_at");
            Instant createdAt = createdAtTs != null ? createdAtTs.toInstant() : Instant.now();
            Set<AuthRole> roles = EnumSet.noneOf(AuthRole.class);

            do {
                String role = result.getString("role");
                if (role != null) {
                    roles.add(AuthRole.valueOf(role));
                }
            } while (result.next());

            return Optional.of(new AuthAccount(userId, storedEmail, displayName, passwordHash, enabled, roles, createdAt));
        }, id);
    }

    public record PageResult<T>(List<T> content, long totalElements, int page, int size, int totalPages) {}

    public PageResult<AuthAccount> findAll(int page, int size, String query) {
        String search = (query != null && !query.isBlank()) ? query.trim().toLowerCase() : null;
        String whereClause = search != null ? "WHERE lower(u.email) LIKE ? OR lower(u.display_name) LIKE ? " : "";
        String countSql = "SELECT count(*) FROM public.parking_auth_users u " + whereClause;

        Long total = search != null
                ? jdbcTemplate.queryForObject(countSql, Long.class, "%" + search + "%", "%" + search + "%")
                : jdbcTemplate.queryForObject(countSql, Long.class);
        long totalElements = total != null ? total : 0L;
        int totalPages = totalElements > 0 ? (int) Math.ceil((double) totalElements / size) : 0;

        if (totalElements == 0 || page >= totalPages) {
            return new PageResult<>(List.of(), totalElements, page, size, totalPages);
        }

        int offset = page * size;
        String idSql = "SELECT u.id FROM public.parking_auth_users u " + whereClause + "ORDER BY u.id ASC LIMIT ? OFFSET ?";
        List<Long> ids = search != null
                ? jdbcTemplate.queryForList(idSql, Long.class, "%" + search + "%", "%" + search + "%", size, offset)
                : jdbcTemplate.queryForList(idSql, Long.class, size, offset);

        if (ids.isEmpty()) {
            return new PageResult<>(List.of(), totalElements, page, size, totalPages);
        }

        String inSql = String.join(",", Collections.nCopies(ids.size(), "?"));
        String selectSql = String.format("""
                SELECT u.id, u.email, u.display_name, u.password_hash, u.enabled, u.created_at, r.role
                FROM public.parking_auth_users u
                LEFT JOIN public.parking_auth_user_roles r ON r.user_id = u.id
                WHERE u.id IN (%s)
                ORDER BY u.id ASC, r.role ASC
                """, inSql);

        class Builder {
            final Long id;
            final String email;
            final String displayName;
            final String passwordHash;
            final boolean enabled;
            final Instant createdAt;
            final Set<AuthRole> roles = EnumSet.noneOf(AuthRole.class);

            Builder(Long id, String email, String displayName, String passwordHash, boolean enabled, Instant createdAt) {
                this.id = id;
                this.email = email;
                this.displayName = displayName;
                this.passwordHash = passwordHash;
                this.enabled = enabled;
                this.createdAt = createdAt;
            }

            AuthAccount build() {
                return new AuthAccount(id, email, displayName, passwordHash, enabled, roles, createdAt);
            }
        }

        Map<Long, Builder> builders = new LinkedHashMap<>();
        for (Long id : ids) {
            builders.put(id, null);
        }

        jdbcTemplate.query(selectSql, rs -> {
            Long uid = rs.getLong("id");
            Builder builder = builders.get(uid);
            if (builder == null) {
                Timestamp ts = rs.getTimestamp("created_at");
                Instant createdAt = ts != null ? ts.toInstant() : Instant.now();
                builder = new Builder(
                        uid,
                        rs.getString("email"),
                        rs.getString("display_name"),
                        rs.getString("password_hash"),
                        rs.getBoolean("enabled"),
                        createdAt
                );
                builders.put(uid, builder);
            }
            String role = rs.getString("role");
            if (role != null) {
                builder.roles.add(AuthRole.valueOf(role));
            }
        }, ids.toArray());

        List<AuthAccount> accounts = builders.values().stream()
                .filter(Objects::nonNull)
                .map(Builder::build)
                .toList();

        return new PageResult<>(accounts, totalElements, page, size, totalPages);
    }

    public boolean existsByEmail(String email) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM public.parking_auth_users WHERE lower(email) = lower(?)",
                Integer.class,
                email
        );
        return count != null && count > 0;
    }

    public int countEnabledAdmins() {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT count(DISTINCT u.id)
                FROM public.parking_auth_users u
                JOIN public.parking_auth_user_roles r ON r.user_id = u.id
                WHERE u.enabled = true AND r.role = 'ADMIN'
                """,
                Integer.class
        );
        return count != null ? count : 0;
    }

    @Transactional
    public AuthAccount create(String email, String displayName, String passwordHash, boolean enabled, Set<AuthRole> roles) {
        String insertUserSql = """
                INSERT INTO public.parking_auth_users (email, display_name, password_hash, enabled, created_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                RETURNING id, created_at
                """;
        record CreatedUser(Long id, Instant createdAt) {}
        CreatedUser created = jdbcTemplate.queryForObject(insertUserSql, (rs, rowNum) -> {
            Long id = rs.getLong("id");
            Timestamp ts = rs.getTimestamp("created_at");
            return new CreatedUser(id, ts != null ? ts.toInstant() : Instant.now());
        }, email.trim(), displayName.trim(), passwordHash, enabled);

        Long userId = created.id();
        for (AuthRole role : roles) {
            jdbcTemplate.update("INSERT INTO public.parking_auth_user_roles (user_id, role) VALUES (?, ?)", userId, role.name());
        }
        return new AuthAccount(userId, email.trim(), displayName.trim(), passwordHash, enabled, roles, created.createdAt());
    }

    @Transactional
    public AuthAccount update(Long id, String displayName, String passwordHash, Boolean enabled, Set<AuthRole> roles) {
        if (displayName != null) {
            jdbcTemplate.update("UPDATE public.parking_auth_users SET display_name = ? WHERE id = ?", displayName.trim(), id);
        }
        if (passwordHash != null) {
            jdbcTemplate.update("UPDATE public.parking_auth_users SET password_hash = ? WHERE id = ?", passwordHash, id);
        }
        if (enabled != null) {
            jdbcTemplate.update("UPDATE public.parking_auth_users SET enabled = ? WHERE id = ?", enabled, id);
        }
        if (roles != null) {
            jdbcTemplate.update("DELETE FROM public.parking_auth_user_roles WHERE user_id = ?", id);
            for (AuthRole role : roles) {
                jdbcTemplate.update("INSERT INTO public.parking_auth_user_roles (user_id, role) VALUES (?, ?)", id, role.name());
            }
        }
        return findById(id).orElseThrow();
    }

    public void deleteSessionsByPrincipalName(String principalName) {
        jdbcTemplate.update("DELETE FROM public.SPRING_SESSION WHERE lower(PRINCIPAL_NAME) = lower(?)", principalName);
    }
}
