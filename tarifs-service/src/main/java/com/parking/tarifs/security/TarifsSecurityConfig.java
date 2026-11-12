package com.parking.tarifs.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Configuration Spring Security minimale pour Tarifs.
 * <p>
 * Les routes /internal/** sont protégées par {@link InternalMachineAuthFilter}
 * (filtre custom à temps constant, avant Spring Security).
 * Les routes /api/** sont ouvertes ici : la validation de session est effectuée
 * manuellement dans les contrôleurs via {@link AuthValidationClient}.
 * <p>
 * CSRF désactivé à ce niveau car nous le validons via le service d'authentification.
 * Pas de session côté Tarifs (stateless).
 */
@Configuration(proxyBeanMethods = false)
public class TarifsSecurityConfig {

    private final InternalMachineAuthFilter machineAuthFilter;

    public TarifsSecurityConfig(InternalMachineAuthFilter machineAuthFilter) {
        this.machineAuthFilter = machineAuthFilter;
    }

    @Bean
    SecurityFilterChain tarifsFilterChain(HttpSecurity http) throws Exception {
        http
            // Enregistrement du filtre machine avant la chaîne Spring Security
            .addFilterBefore(machineAuthFilter, UsernamePasswordAuthenticationFilter.class)
            // Pas de session côté Tarifs
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // CSRF géré via le service d'authentification (validate-user-request)
            .csrf(AbstractHttpConfigurer::disable)
            // Pas de cache de requête
            .requestCache(AbstractHttpConfigurer::disable)
            // Toutes les routes autorisées au niveau Spring Security ;
            // l'accès réel est contrôlé par InternalMachineAuthFilter et AuthValidationClient
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());

        return http.build();
    }
}

