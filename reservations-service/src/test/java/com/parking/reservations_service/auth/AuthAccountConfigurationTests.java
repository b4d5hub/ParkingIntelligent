package com.parking.reservations_service.auth;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;

import javax.sql.DataSource;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class AuthAccountConfigurationTests {

    @Test
    void leavesDatabaseAuthenticationInactiveByDefault() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.register(AuthAccountConfiguration.class);
            context.refresh();

            assertTrue(context.getBeansOfType(UserDetailsService.class).isEmpty());
            assertTrue(context.getBeansOfType(JdbcAuthAccountRepository.class).isEmpty());
        }
    }

    @Test
    void authProfileRegistersAccountLayerWithoutQueryingDatabaseAtStartup() {
        DataSource dataSource = mock(DataSource.class);
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.getEnvironment().setActiveProfiles("auth");
            context.registerBean(JdbcTemplate.class, () -> jdbcTemplate);
            context.register(AuthAccountConfiguration.class);
            context.refresh();

            assertInstanceOf(ParkingUserDetailsService.class, context.getBean(UserDetailsService.class));
            assertNotNull(context.getBean(PasswordEncoder.class));
            assertNotNull(context.getBean(JdbcAuthAccountRepository.class));
            verifyNoInteractions(dataSource);
        }
    }
}
