package com.parking.reservations_service.auth;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.springframework.security.config.Customizer.withDefaults;

@Configuration(proxyBeanMethods = false)
@Profile("auth")
public class AuthWebSecurityConfiguration {

    @Bean
    SecurityFilterChain authSecurityFilterChain(HttpSecurity http, ObjectMapper objectMapper) throws Exception {
        http
                .csrf(withDefaults())
                .requestCache(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .sessionFixation(fixation -> fixation.changeSessionId()))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.GET, "/api/auth/csrf").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()
                        .anyRequest().denyAll())
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, exception) -> writeJson(objectMapper, response,
                                401, new AuthErrorResponse("AUTHENTICATION_REQUIRED", "Authentification requise")))
                        .accessDeniedHandler((request, response, exception) -> {
                            AuthErrorResponse body = exception instanceof CsrfException
                                    ? new AuthErrorResponse("CSRF_INVALID", "Jeton CSRF absent ou invalide")
                                    : new AuthErrorResponse("ACCESS_DENIED", "Accès refusé");
                            writeJson(objectMapper, response, 403, body);
                        }))
                .formLogin(form -> form
                        .loginPage("/api/auth/login")
                        .loginProcessingUrl("/api/auth/login")
                        .usernameParameter("email")
                        .passwordParameter("password")
                        .successHandler((request, response, authentication) -> writeJson(objectMapper, response, 200,
                                AuthUserResponse.fromPrincipal((ParkingUserPrincipal) authentication.getPrincipal())))
                        .failureHandler((request, response, exception) -> {
                            if (exception instanceof AuthenticationServiceException) {
                                writeJson(objectMapper, response, 503,
                                        new AuthErrorResponse("AUTHENTICATION_UNAVAILABLE", "Authentification indisponible"));
                            } else {
                                writeJson(objectMapper, response, 401,
                                        new AuthErrorResponse("INVALID_CREDENTIALS", "Identifiants invalides"));
                            }
                        }))
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .invalidateHttpSession(true)
                        .clearAuthentication(true)
                        .deleteCookies("PARKING_SESSION")
                        .logoutSuccessHandler((request, response, authentication) -> {
                            response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
                            response.setStatus(HttpServletResponse.SC_NO_CONTENT);
                        }));

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
