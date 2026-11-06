package com.parking.reservations_service.auth;

import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

public class ParkingUserDetailsService implements UserDetailsService {

    private final JdbcAuthAccountRepository accountRepository;

    public ParkingUserDetailsService(JdbcAuthAccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @Override
    public ParkingUserPrincipal loadUserByUsername(String email) {
        if (email == null || email.isBlank()) {
            throw new UsernameNotFoundException("Identifiants invalides");
        }

        AuthAccount account = accountRepository.findByEmail(email.strip())
                .filter(found -> !found.roles().isEmpty())
                .orElseThrow(() -> new UsernameNotFoundException("Identifiants invalides"));

        return new ParkingUserPrincipal(account);
    }
}
