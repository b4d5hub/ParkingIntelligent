package com.parking.places_service.service;

import com.parking.places_service.entity.Place;
import com.parking.places_service.entity.Statut;
import com.parking.places_service.repository.PlaceRepository;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@Service
public class PlaceService {

    private final PlaceRepository places;
    private static final int NUMERO_MAX = 20;

    public PlaceService(PlaceRepository places) {
        this.places = places;
    }

    @Transactional
    public Place create(String numero) {
        if (numero == null || numero.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Numéro de place obligatoire");
        }
        String clean = numero.trim();
        if (clean.length() > NUMERO_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Numéro de place trop long (" + NUMERO_MAX + " caractères maximum)");
        }
        if (places.existsByNumero(clean)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Numéro de place déjà utilisé");
        }
        Place place = new Place();
        place.setNumero(clean);
        return places.save(place);
    }

    @Transactional(readOnly = true)
    public List<Place> list(Statut statut) {
        return statut == null ? places.findAll(Sort.by("id")) : places.findByStatutOrderById(statut);
    }

    @Transactional(readOnly = true)
    public Place get(long id) {
        return places.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    @Transactional
    public Place changeStatut(long id, Statut target) {
        if (target != Statut.LIBRE && target != Statut.HORS_SERVICE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut non autorisé");
        }
        Place place = places.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (place.getStatut() == Statut.OCCUPEE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Place occupée : enregistrer le départ d'abord");
        }
        place.setStatut(target);
        return place;
    }
}