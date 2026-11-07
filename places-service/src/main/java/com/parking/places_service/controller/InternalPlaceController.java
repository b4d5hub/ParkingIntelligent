package com.parking.places_service.controller;

import com.parking.places_service.entity.Place;
import com.parking.places_service.entity.Statut;
import com.parking.places_service.repository.PlaceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/internal/places")
public class InternalPlaceController {

    // Format attendu par Réservations : id en texte, deux booléens
    public record PlaceView(String id, boolean enService, boolean occupee) {
    }

    private final PlaceRepository places;

    public InternalPlaceController(PlaceRepository places) {
        this.places = places;
    }

    @GetMapping("/{id}")
    public PlaceView get(@PathVariable long id) {
        Place place = places.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return new PlaceView(
                String.valueOf(place.getId()),
                place.getStatut() != Statut.HORS_SERVICE,
                place.getStatut() == Statut.OCCUPEE);
    }
}