package com.parking.auth_service.dto;

import java.util.List;

public record AdminUpdateUserRequest(
        Boolean enabled,
        String displayName,
        List<String> roles,
        String newPassword
) {
    @Override
    public String toString() {
        return "AdminUpdateUserRequest[enabled=" + enabled + ", displayName=" + displayName + ", roles=" + roles + ", newPassword=" + (newPassword != null ? "[PROTECTED]" : "null") + "]";
    }
}
