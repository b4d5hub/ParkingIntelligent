package com.parking.auth_service.dto;

import com.parking.auth_service.model.AuthAccount;
import com.parking.auth_service.model.AuthRole;

import java.time.Instant;
import java.util.List;

public record AdminUserSummaryResponse(
        Long id,
        String email,
        String displayName,
        boolean enabled,
        List<String> roles,
        Instant createdAt
) {
    public static AdminUserSummaryResponse fromAccount(AuthAccount account) {
        List<String> roleNames = account.roles().stream()
                .map(AuthRole::name)
                .sorted()
                .toList();
        return new AdminUserSummaryResponse(
                account.id(),
                account.email(),
                account.displayName(),
                account.enabled(),
                roleNames,
                account.createdAt()
        );
    }
}
