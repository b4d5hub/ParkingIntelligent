package com.parking.reservations_service.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration(proxyBeanMethods = false)
@EnableScheduling
public class ReservationConfiguration {
    @Bean
    Clock parkingClock() { return Clock.systemUTC(); }
}
