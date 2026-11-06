package com.parking.reservations_service.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;

// Ne pas activer avant l'approbation et l'application du schema des comptes.
@Configuration(proxyBeanMethods = false)
@Profile("auth")
public class AuthAccountConfiguration {

    @Bean
    PasswordEncoder passwordEncoder() {
        PasswordEncoder argon2 = new Argon2PasswordEncoder(16, 32, 1, 19456, 2);
        return new DelegatingPasswordEncoder("argon2", Map.of("argon2", argon2));
    }

    @Bean
    JdbcAuthAccountRepository authAccountRepository(JdbcTemplate jdbcTemplate) {
        return new JdbcAuthAccountRepository(jdbcTemplate);
    }

    @Bean
    UserDetailsService parkingUserDetailsService(JdbcAuthAccountRepository accountRepository) {
        return new ParkingUserDetailsService(accountRepository);
    }
}
