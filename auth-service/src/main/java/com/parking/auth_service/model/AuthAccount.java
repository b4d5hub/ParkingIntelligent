package com.parking.auth_service.model;

import java.time.Instant;
import java.util.Objects;
import java.util.Set;

public record AuthAccount(
        Long id,
        String email,
        String displayName,
        String passwordHash,
        boolean enabled,
        Set<AuthRole> roles,
        Instant createdAt
) {
    public AuthAccount(Long id, String email, String displayName, String passwordHash, boolean enabled, Set<AuthRole> roles) {
        this(id, email, displayName, passwordHash, enabled, roles, Instant.now());
    }

    public AuthAccount {
        Objects.requireNonNull(email, "email must not be null");
        Objects.requireNonNull(displayName, "displayName must not be null");
        Objects.requireNonNull(passwordHash, "passwordHash must not be null");
        roles = roles == null ? Set.of() : Set.copyOf(roles);
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    @Override
    public String toString() {
        return "AuthAccount[id=" + id + ", enabled=" + enabled + ", roles=" + roles + "]";
    }
}
