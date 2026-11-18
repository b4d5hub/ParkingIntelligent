package com.parking.auth_service.security;

import com.parking.auth_service.model.AuthAccount;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.io.Serial;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;

public final class ParkingUserPrincipal extends User {

    @Serial
    private static final long serialVersionUID = 1L;

    private final Long userId;
    private final String displayName;
    private final String credentialStamp;

    public ParkingUserPrincipal(AuthAccount account) {
        super(account.email(), account.passwordHash(), account.enabled(), true, true, true,
                account.roles().stream()
                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                        .toList());
        this.userId = account.id();
        this.displayName = account.displayName();
        this.credentialStamp = credentialStamp(account.passwordHash());
    }

    public Long getUserId() {
        return userId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getCredentialStamp() {
        return credentialStamp;
    }

    public static String credentialStamp(String encodedPassword) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(encodedPassword.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ParkingUserPrincipal that)) return false;
        if (!super.equals(o)) return false;
        return Objects.equals(userId, that.userId) &&
                Objects.equals(displayName, that.displayName) &&
                Objects.equals(credentialStamp, that.credentialStamp);
    }

    @Override
    public int hashCode() {
        return Objects.hash(super.hashCode(), userId, displayName, credentialStamp);
    }
}
