package com.parking.auth_service.dto;

import java.util.List;

public record AdminCreateUserRequest(
        String email,
        String displayName,
        String password,
        List<String> roles
) {
    @Override
    public String toString() {
        return "AdminCreateUserRequest[email=" + email + ", displayName=" + displayName + ", roles=" + roles + "]";
    }
}
