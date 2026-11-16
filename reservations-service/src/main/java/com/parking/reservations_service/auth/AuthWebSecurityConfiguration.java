package com.parking.reservations_service.auth;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Configuration(proxyBeanMethods = false)
@Profile("auth")
public class AuthWebSecurityConfiguration {

    @Bean
    SecurityFilterChain authSecurityFilterChain(HttpSecurity http, ObjectMapper objectMapper,
            ObjectProvider<ReservationUserAuthFilter> userAuthFilterProvider) throws Exception {
        var userAuthFilter = userAuthFilterProvider.getIfAvailable();
        http
                .csrf(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.GET, "/api/reservations/operations").hasRole("AGENT")
                        .requestMatchers(HttpMethod.POST, "/api/reservations/*/arrival", "/api/reservations/*/departure").hasRole("AGENT")
                        .requestMatchers(HttpMethod.GET, "/api/reservations/availability").permitAll()
                        .requestMatchers("/api/reservations", "/api/reservations/**").hasRole("CONDUCTEUR")
                        .requestMatchers("/internal/**").permitAll()
                        .requestMatchers("/actuator/**").permitAll()
                        .anyRequest().denyAll())
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, exception) -> writeJson(objectMapper, response,
                                401, new AuthErrorResponse("AUTHENTICATION_REQUIRED", "Authentification requise")))
                        .accessDeniedHandler((request, response, exception) -> writeJson(objectMapper, response,
                                403, new AuthErrorResponse("ACCESS_DENIED", "Accès refusé"))));

        if (userAuthFilter != null) {
            http.addFilterBefore(userAuthFilter, UsernamePasswordAuthenticationFilter.class);
        }
        return http.build();
    }

    private static void writeJson(ObjectMapper objectMapper, HttpServletResponse response, int status, Object body)
            throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
