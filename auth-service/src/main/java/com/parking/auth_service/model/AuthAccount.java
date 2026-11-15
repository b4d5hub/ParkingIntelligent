package com.parking.auth_service.model;

import java.util.Objects;
import java.util.Set;

public record AuthAccount(
        Long id,
        String email,
        String displayName,
        String passwordHash,
        boolean enabled,
        Set<AuthRole> roles
) {
    public AuthAccount {
        Objects.requireNonNull(email, "email must not be null");
        Objects.requireNonNull(displayName, "displayName must not be null");
        Objects.requireNonNull(passwordHash, "passwordHash must not be null");
        roles = Set.copyOf(roles);
    }

    @Override
    public String toString() {
        return "AuthAccount[id=" + id + ", enabled=" + enabled + ", roles=" + roles + "]";
    }
}
