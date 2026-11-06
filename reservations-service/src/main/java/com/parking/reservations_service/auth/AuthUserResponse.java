package com.parking.reservations_service.auth;

import org.springframework.security.core.GrantedAuthority;

import java.util.List;

public record AuthUserResponse(String userId, String displayName, List<String> roles) {

    public static AuthUserResponse fromPrincipal(ParkingUserPrincipal principal) {
        List<String> roles = principal.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(authority -> authority.startsWith("ROLE_"))
                .map(authority -> authority.substring(5))
                .sorted()
                .toList();
        return new AuthUserResponse(principal.getUserId().toString(), principal.getDisplayName(), roles);
    }
}
