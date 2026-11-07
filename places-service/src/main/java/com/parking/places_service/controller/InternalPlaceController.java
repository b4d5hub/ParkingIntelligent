package com.parking.places_service.controller;

import com.parking.places_service.entity.Place;
import com.parking.places_service.entity.Statut;
import com.parking.places_service.repository.PlaceRepository;
import com.parking.places_service.service.OccupationService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/internal/places")
public class InternalPlaceController {

    public record PlaceView(String id, boolean enService, boolean occupee) {
    }

    public record OccupationRequest(String reservationId) {
    }

    private final PlaceRepository places;
    private final OccupationService occupation;

    public InternalPlaceController(PlaceRepository places, OccupationService occupation) {
        this.places = places;
        this.occupation = occupation;
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

    @PostMapping("/{id}/occupy")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void occupy(@PathVariable long id,
            @RequestHeader("Idempotency-Key") String key,
            @RequestBody OccupationRequest body) {
        occupation.occupy(id, reservationId(body), checkKey(key));
    }

    @PostMapping("/{id}/release")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void release(@PathVariable long id,
            @RequestHeader("Idempotency-Key") String key,
            @RequestBody OccupationRequest body) {
        occupation.release(id, reservationId(body), checkKey(key));
    }

    private long reservationId(OccupationRequest body) {
        try {
            return Long.parseLong(body.reservationId());
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservationId invalide");
        }
    }

    private String checkKey(String key) {
        if (key.isBlank() || key.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key invalide");
        }
        return key;
    }
}