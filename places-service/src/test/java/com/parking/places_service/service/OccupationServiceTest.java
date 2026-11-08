package com.parking.places_service.service;

import com.parking.places_service.entity.Place;
import com.parking.places_service.entity.PlaceCommand;
import com.parking.places_service.entity.Statut;
import com.parking.places_service.repository.PlaceCommandRepository;
import com.parking.places_service.repository.PlaceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class OccupationServiceTest {

    private PlaceRepository places;
    private PlaceCommandRepository commands;
    private OccupationService service;

    @BeforeEach
    void initialiser() {
        places = mock(PlaceRepository.class);
        commands = mock(PlaceCommandRepository.class);
        service = new OccupationService(places, commands);
    }

    private Place placeTrouvee(Statut statut, Long reservationId) {
        Place p = new Place();
        p.setNumero("A1");
        p.setStatut(statut);
        p.setReservationId(reservationId);
        when(places.findByIdForUpdate(1L)).thenReturn(Optional.of(p));
        return p;
    }

    private static int code(ResponseStatusException e) {
        return e.getStatusCode().value();
    }

    // ---------- occupy ----------

    @Test
    void occuperUnePlaceLibre() {
        Place p = placeTrouvee(Statut.LIBRE, null);
        service.occupy(1L, 10L, "reservation/10/OCCUPY");
        assertEquals(Statut.OCCUPEE, p.getStatut());
        assertEquals(Long.valueOf(10L), p.getReservationId());
        verify(commands).save(any(PlaceCommand.class));
    }

    @Test
    void occuperAvecUneCleDejaTraiteeNeChangeRien() { // idempotence
        Place p = placeTrouvee(Statut.LIBRE, null);
        when(commands.existsById("reservation/10/OCCUPY")).thenReturn(true);
        service.occupy(1L, 10L, "reservation/10/OCCUPY");
        assertEquals(Statut.LIBRE, p.getStatut());
        verify(commands, never()).save(any(PlaceCommand.class));
    }

    @Test
    void occuperUnePlaceHorsServiceEstRefuse() {
        placeTrouvee(Statut.HORS_SERVICE, null);
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.occupy(1L, 10L, "reservation/10/OCCUPY"));
        assertEquals(409, code(e));
        verify(commands, never()).save(any(PlaceCommand.class));
    }

    @Test
    void occuperUnePlaceOccupeeParUneAutreReservationEstRefuse() {
        Place p = placeTrouvee(Statut.OCCUPEE, 10L);
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.occupy(1L, 11L, "reservation/11/OCCUPY"));
        assertEquals(409, code(e));
        assertEquals(Long.valueOf(10L), p.getReservationId());
    }

    @Test
    void occuperUneSecondeFoisPourLaMemeReservationEstAccepte() { // cas limite
        Place p = placeTrouvee(Statut.OCCUPEE, 10L);
        service.occupy(1L, 10L, "autre-cle");
        assertEquals(Statut.OCCUPEE, p.getStatut());
        assertEquals(Long.valueOf(10L), p.getReservationId());
    }

    @Test
    void occuperUnePlaceInconnue() {
        when(places.findByIdForUpdate(99L)).thenReturn(Optional.empty());
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.occupy(99L, 10L, "reservation/10/OCCUPY"));
        assertEquals(404, code(e));
    }

    // ---------- release ----------

    @Test
    void libererUnePlaceOccupeeParLaBonneReservation() {
        Place p = placeTrouvee(Statut.OCCUPEE, 10L);
        service.release(1L, 10L, "reservation/10/RELEASE");
        assertEquals(Statut.LIBRE, p.getStatut());
        assertNull(p.getReservationId());
        verify(commands).save(any(PlaceCommand.class));
    }

    @Test
    void libererUnePlaceOccupeeParUneAutreReservationEstRefuse() {
        Place p = placeTrouvee(Statut.OCCUPEE, 10L);
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.release(1L, 11L, "reservation/11/RELEASE"));
        assertEquals(409, code(e));
        assertEquals(Statut.OCCUPEE, p.getStatut());
    }

    @Test
    void libererUnePlaceDejaLibreReussitSansRienChanger() { // cas limite
        Place p = placeTrouvee(Statut.LIBRE, null);
        service.release(1L, 10L, "reservation/10/RELEASE");
        assertEquals(Statut.LIBRE, p.getStatut());
    }
}