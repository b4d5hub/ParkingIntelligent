package com.parking.reservations_service.auth;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class AuthPasswordEncoderTests {

    private final PasswordEncoder passwordEncoder = new AuthAccountConfiguration().passwordEncoder();

    @Test
    void producesSaltedArgon2idHashesWithConfiguredParameters() {
        String password = "Phrase de test uniquement 2026";
        String firstHash = passwordEncoder.encode(password);
        String secondHash = passwordEncoder.encode(password);

        assertTrue(firstHash.startsWith("{argon2}$argon2id$v=19$m=19456,t=2,p=1$"));
        assertNotEquals(firstHash, secondHash);
        assertFalse(firstHash.contains(password));
        assertTrue(passwordEncoder.matches(password, firstHash));
        assertFalse(passwordEncoder.matches("incorrect", firstHash));
    }

    @Test
    void rejectsUnapprovedPlaintextPasswordFormat() {
        assertThrows(IllegalArgumentException.class,
                () -> passwordEncoder.matches("test-only", "{noop}test-only"));
    }

    @Test
    void accountAndPrincipalStringsDoNotExposePasswordHash() {
        String hash = passwordEncoder.encode("Phrase de test uniquement 2026");
        AuthAccount account = new AuthAccount(42L, "driver@example.test", "Conducteur", hash,
                true, Set.of(AuthRole.CONDUCTEUR));

        assertFalse(account.toString().contains(hash));
        assertFalse(new ParkingUserPrincipal(account).toString().contains(hash));
    }
}
