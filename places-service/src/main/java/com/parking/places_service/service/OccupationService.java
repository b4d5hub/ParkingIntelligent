package com.parking.places_service.service;

import com.parking.places_service.entity.Place;
import com.parking.places_service.entity.PlaceCommand;
import com.parking.places_service.entity.Statut;
import com.parking.places_service.repository.PlaceCommandRepository;
import com.parking.places_service.repository.PlaceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OccupationService {

    private final PlaceRepository places;
    private final PlaceCommandRepository commands;

    public OccupationService(PlaceRepository places, PlaceCommandRepository commands) {
        this.places = places;
        this.commands = commands;
    }

    @Transactional
    public void occupy(long placeId, long reservationId, String key) {
        Place place = places.findByIdForUpdate(placeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (commands.existsById(key)) {
            return; // commande déjà traitée
        }
        boolean memeReservation = place.getStatut() == Statut.OCCUPEE
                && Long.valueOf(reservationId).equals(place.getReservationId());
        if (!memeReservation) {
            if (place.getStatut() == Statut.HORS_SERVICE || place.getStatut() == Statut.OCCUPEE) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Place indisponible");
            }
            place.setStatut(Statut.OCCUPEE);
            place.setReservationId(reservationId);
        }
        commands.save(new PlaceCommand(key, placeId, "OCCUPY", reservationId));
    }

    @Transactional
    public void release(long placeId, long reservationId, String key) {
        Place place = places.findByIdForUpdate(placeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (commands.existsById(key)) {
            return;
        }
        if (place.getStatut() == Statut.OCCUPEE) {
            if (!Long.valueOf(reservationId).equals(place.getReservationId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Place occupée par une autre réservation");
            }
            place.setStatut(Statut.LIBRE);
            place.setReservationId(null);
        }
        commands.save(new PlaceCommand(key, placeId, "RELEASE", reservationId));
    }
}