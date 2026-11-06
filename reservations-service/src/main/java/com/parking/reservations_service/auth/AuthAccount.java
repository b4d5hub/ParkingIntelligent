package com.parking.reservations_service.auth;

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
        roles = Set.copyOf(roles);
    }

    @Override
    public String toString() {
        return "AuthAccount[id=" + id + ", enabled=" + enabled + ", roles=" + roles + "]";
    }
}
