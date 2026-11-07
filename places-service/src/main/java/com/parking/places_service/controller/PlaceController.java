package com.parking.places_service.controller;

import com.parking.places_service.entity.Place;
import com.parking.places_service.entity.Statut;
import com.parking.places_service.service.PlaceService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/places")
public class PlaceController {

    public record CreatePlaceRequest(@NotBlank @Size(max = 20) String numero) {
    }

    public record ChangeStatutRequest(@NotNull Statut statut) {
    }

    public record PlaceDto(String id, String numero, Statut statut) {
        static PlaceDto from(Place p) {
            return new PlaceDto(String.valueOf(p.getId()), p.getNumero(), p.getStatut());
        }
    }

    private final PlaceService service;

    public PlaceController(PlaceService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlaceDto create(@Valid @RequestBody CreatePlaceRequest body) {
        return PlaceDto.from(service.create(body.numero()));
    }

    @GetMapping
    public List<PlaceDto> list(@RequestParam(required = false) Statut statut) {
        return service.list(statut).stream().map(PlaceDto::from).toList();
    }

    @GetMapping("/{id}")
    public PlaceDto get(@PathVariable long id) {
        return PlaceDto.from(service.get(id));
    }

    @PatchMapping("/{id}/statut")
    public PlaceDto changeStatut(@PathVariable long id, @Valid @RequestBody ChangeStatutRequest body) {
        return PlaceDto.from(service.changeStatut(id, body.statut()));
    }
}