package com.parking.reservations_service.auth;

import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.session.jdbc.config.annotation.web.http.EnableJdbcHttpSession;
import org.springframework.session.web.http.*;
import tools.jackson.databind.ObjectMapper;
import java.time.*;

@Configuration(proxyBeanMethods = false)
@Profile("auth")
@EnableJdbcHttpSession(maxInactiveIntervalInSeconds = 1800)
public class AuthSessionConfiguration {
    @Bean CookieSerializer cookieSerializer(Environment environment) {
        var cookie = new DefaultCookieSerializer();
        cookie.setCookieName("PARKING_SESSION"); cookie.setCookiePath("/");
        cookie.setUseHttpOnlyCookie(true); cookie.setSameSite("Lax"); cookie.setUseBase64Encoding(false);
        cookie.setUseSecureCookie(environment.getProperty("server.servlet.session.cookie.secure", Boolean.class, true));
        return cookie;
    }
    @Bean AuthSessionPolicy authSessionPolicy(JdbcAuthAccountRepository accounts, Clock clock, Environment env, ObjectMapper mapper) {
        Duration absolute = Duration.parse(env.getProperty("parking.auth.absolute-timeout", "PT8H"));
        if (absolute.isNegative() || absolute.isZero()) { throw new IllegalArgumentException("Invalid session timeout"); }
        return new AuthSessionPolicy(accounts, clock, absolute, mapper);
    }
    // The filter belongs only inside Spring Security, not a second servlet registration.
    @Bean FilterRegistrationBean<AuthSessionPolicy> sessionPolicyRegistration(AuthSessionPolicy policy) {
        var registration = new FilterRegistrationBean<>(policy); registration.setEnabled(false); return registration;
    }
}
