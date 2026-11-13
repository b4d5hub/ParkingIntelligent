package com.parking.places_service.service;

import com.parking.places_service.entity.Place;
import com.parking.places_service.entity.Statut;
import com.parking.places_service.repository.PlaceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PlaceServiceTest {

    private PlaceRepository places;
    private PlaceService service;

    @BeforeEach
    void initialiser() {
        places = mock(PlaceRepository.class);
        service = new PlaceService(places);
        when(places.save(any(Place.class))).thenAnswer(appel -> appel.getArgument(0));
    }

    private static Place place(Statut statut) {
        Place p = new Place();
        p.setNumero("A1");
        p.setStatut(statut);
        return p;
    }

    private static int code(ResponseStatusException e) {
        return e.getStatusCode().value();
    }

    // ---------- create ----------

    @Test
    void creerPlaceNormale() {
        Place p = service.create("  A1  ");
        assertEquals("A1", p.getNumero()); // espaces retirés
        assertEquals(Statut.LIBRE, p.getStatut()); // une nouvelle place est libre
        verify(places).save(any(Place.class));
    }

    @Test
    void creerPlaceAvecNumeroDeVingtCaracteres() { // cas limite accepté
        String numero = "A".repeat(20);
        assertEquals(numero, service.create(numero).getNumero());
    }

    @Test
    void creerPlaceAvecNumeroDejaUtilise() {
        when(places.existsByNumero("A1")).thenReturn(true);
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> service.create("A1"));
        assertEquals(409, code(e));
        verify(places, never()).save(any(Place.class));
    }

    @Test
    void creerPlaceAvecNumeroVide() {
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> service.create("   "));
        assertEquals(400, code(e));
        verify(places, never()).save(any(Place.class));
    }

    @Test
    void creerPlaceAvecNumeroNull() {
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> service.create(null));
        assertEquals(400, code(e));
    }

    @Test
    void creerPlaceAvecNumeroDeVingtEtUnCaracteres() { // cas limite refusé
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.create("A".repeat(21)));
        assertEquals(400, code(e));
        verify(places, never()).save(any(Place.class));
    }

    // ---------- changeStatut ----------

    @Test
    void mettreUnePlaceHorsService() {
        Place p = place(Statut.LIBRE);
        when(places.findByIdForUpdate(1L)).thenReturn(Optional.of(p));
        assertEquals(Statut.HORS_SERVICE, service.changeStatut(1L, Statut.HORS_SERVICE).getStatut());
    }

    @Test
    void remettreUnePlaceEnService() {
        Place p = place(Statut.HORS_SERVICE);
        when(places.findByIdForUpdate(1L)).thenReturn(Optional.of(p));
        assertEquals(Statut.LIBRE, service.changeStatut(1L, Statut.LIBRE).getStatut());
    }

    @Test
    void changerLeStatutDUnePlaceOccupeeEstRefuse() {
        Place p = place(Statut.OCCUPEE);
        when(places.findByIdForUpdate(1L)).thenReturn(Optional.of(p));
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.changeStatut(1L, Statut.HORS_SERVICE));
        assertEquals(409, code(e));
        assertEquals(Statut.OCCUPEE, p.getStatut()); // rien n'a changé
    }

    @Test
    void lAdministrateurNePeutPasImposerOccupee() {
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.changeStatut(1L, Statut.OCCUPEE));
        assertEquals(400, code(e));
        verify(places, never()).findByIdForUpdate(any());
    }

    @Test
    void changerLeStatutDUnePlaceInconnue() {
        when(places.findByIdForUpdate(99L)).thenReturn(Optional.empty());
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> service.changeStatut(99L, Statut.LIBRE));
        assertEquals(404, code(e));
    }
}