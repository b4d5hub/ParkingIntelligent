package com.parking.auth_service.config;

import com.parking.auth_service.dto.AuthErrorResponse;
import com.parking.auth_service.dto.AuthUserResponse;
import com.parking.auth_service.security.AuthLoginThrottle;
import com.parking.auth_service.security.AuthSessionPolicy;
import com.parking.auth_service.security.ParkingUserPrincipal;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Clock;

@Configuration(proxyBeanMethods = false)
@ConditionalOnWebApplication
@Profile("!provision")
public class AuthWebSecurityConfiguration {

    @Bean
    @Order(2)
    SecurityFilterChain authSecurityFilterChain(HttpSecurity http, ObjectMapper objectMapper,
            ObjectProvider<AuthSessionPolicy> policyProvider, Environment environment, Clock clock) throws Exception {
        var csrf = new HttpSessionCsrfTokenRepository();
        csrf.setSessionAttributeName("PARKING_CSRF");
        var policy = policyProvider.getIfAvailable();

        http
                .securityMatcher("/api/auth/**", "/actuator/**")
                .csrf(config -> config.csrfTokenRepository(csrf).ignoringRequestMatchers("/actuator/**"))
                .requestCache(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .sessionFixation(fixation -> fixation.changeSessionId()))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/actuator/**").permitAll()
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
                        .successHandler((request, response, authentication) -> {
                            if (policy != null) {
                                policy.initialize(request.getSession());
                            }
                            writeJson(objectMapper, response, 200,
                                    AuthUserResponse.fromPrincipal((ParkingUserPrincipal) authentication.getPrincipal()));
                        })
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

        if (policy != null) {
            http.addFilterAfter(policy, AnonymousAuthenticationFilter.class);
        }
        http.addFilterBefore(new AuthLoginThrottle(clock,
                environment.getProperty("parking.auth.login-account-limit", Integer.class, 10),
                environment.getProperty("parking.auth.login-address-limit", Integer.class, 50), objectMapper),
                UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private static void writeJson(ObjectMapper objectMapper, HttpServletResponse response, int status, Object body)
            throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-store");
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
