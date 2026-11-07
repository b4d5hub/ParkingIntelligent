package com.parking.reservations_service;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "PARKING_INTEGRATION", matches = "true")
class ReservationsServiceApplicationTests {

	@Test
	void contextLoads() {
	}

}
