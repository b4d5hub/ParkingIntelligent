package com.parking.auth_service.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.util.Map;

@Configuration(proxyBeanMethods = false)
public class AuthAccountConfiguration {

    @Bean
    public PasswordEncoder passwordEncoder() {
        PasswordEncoder argon2 = new Argon2PasswordEncoder(16, 32, 1, 19456, 2);
        return new DelegatingPasswordEncoder("argon2", Map.of("argon2", argon2));
    }

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
