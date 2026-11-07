package com.parking.reservations_service.auth;

import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import tools.jackson.databind.ObjectMapper;
import java.util.*;

@Configuration(proxyBeanMethods = false)
@Profile("auth")
public class InternalAuthConfiguration {
    @Bean @Order(1)
    SecurityFilterChain internalAuthChain(HttpSecurity http, Environment env, PasswordEncoder encoder, ObjectMapper mapper) throws Exception {
        List<UserDetails> clients = new ArrayList<>();
        Set<String> names = new HashSet<>();
        for (String service : List.of("places", "tarifs", "abonnements")) {
            String name = env.getProperty("parking.auth.clients." + service + ".username", "");
            String hash = env.getProperty("parking.auth.clients." + service + ".password-hash", "");
            if (name.isBlank() && hash.isBlank()) { continue; }
            if (name.isBlank() || !hash.startsWith("{argon2}") || !names.add(name)) {
                throw new IllegalArgumentException("Invalid internal authentication client configuration");
            }
            clients.add(User.withUsername(name).password(hash).roles("AUTH_VALIDATOR").build());
        }
        var provider = new DaoAuthenticationProvider(new InMemoryUserDetailsManager(clients));
        provider.setPasswordEncoder(encoder);
        http.securityMatcher("/internal/auth/**")
            .authenticationManager(new ProviderManager(provider))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(AbstractHttpConfigurer::disable)
            .requestCache(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth.requestMatchers(org.springframework.http.HttpMethod.POST,
                    "/internal/auth/validate-user-request").hasRole("AUTH_VALIDATOR").anyRequest().denyAll())
            .httpBasic(basic -> basic.authenticationEntryPoint((request, response, failure) -> {
                response.setStatus(401); response.setContentType("application/json"); response.setHeader("Cache-Control", "no-store");
                mapper.writeValue(response.getOutputStream(), new AuthErrorResponse("INVALID_SERVICE_CREDENTIALS", "Client interne non autorisé"));
            }));
        return http.build();
    }
}
