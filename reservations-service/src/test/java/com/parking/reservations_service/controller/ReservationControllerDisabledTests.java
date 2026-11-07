package com.parking.reservations_service.controller;

import com.parking.reservations_service.service.ReservationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ReservationController.class)
@WithMockUser
class ReservationControllerDisabledTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ReservationService reservationService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @Test
    void doesNotExposeReservationsWithoutLocalProfile() throws Exception {
        mockMvc.perform(get("/api/reservations"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/reservations/1"))
                .andExpect(status().isNotFound());
        verifyNoInteractions(reservationService);
    }
}
