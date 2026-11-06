package com.parking.reservations_service.auth;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.io.Serial;

public final class ParkingUserPrincipal extends User {

    @Serial
    private static final long serialVersionUID = 1L;

    private final Long userId;
    private final String displayName;

    public ParkingUserPrincipal(AuthAccount account) {
        super(account.email(), account.passwordHash(), account.enabled(), true, true, true,
                account.roles().stream()
                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                        .toList());
        this.userId = account.id();
        this.displayName = account.displayName();
    }

    public Long getUserId() {
        return userId;
    }

    public String getDisplayName() {
        return displayName;
    }
}
