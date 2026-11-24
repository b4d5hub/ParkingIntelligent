package com.parking.auth_service.security;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthLoginThrottleTests {

    @Test
    void limitsAnAccountAcrossAddressesAndResetsAfterFiveMinutes() {
        Clock clock = mock(Clock.class);
        when(clock.millis()).thenReturn(0L);
        var throttle = new AuthLoginThrottle(clock, 2, 10, new ObjectMapper());
        assertTrue(throttle.allow(" Test@example.test ", "1"));
        assertTrue(throttle.allow("test@example.test", "2"));
        assertFalse(throttle.allow("TEST@example.test", "3"));
        when(clock.millis()).thenReturn(300_000L);
        assertTrue(throttle.allow("test@example.test", "3"));
    }

    @Test
    void limitsAnAddressAcrossDifferentAccounts() {
        var throttle = new AuthLoginThrottle(Clock.systemUTC(), 10, 2, new ObjectMapper());
        assertTrue(throttle.allow("a", "1"));
        assertTrue(throttle.allow("b", "1"));
        assertFalse(throttle.allow("c", "1"));
        assertTrue(throttle.allow("c", "2"));
    }
}
