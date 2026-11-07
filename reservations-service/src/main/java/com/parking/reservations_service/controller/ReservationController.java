package com.parking.reservations_service.controller;

import com.parking.reservations_service.dto.*;
import com.parking.reservations_service.auth.ParkingUserPrincipal;
import com.parking.reservations_service.integration.ParkingGateway;
import com.parking.reservations_service.service.ReservationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Profile("auth")
@RestController
@RequestMapping("/api/reservations")
public class ReservationController {

    private final ReservationService reservationService;

    public ReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    @GetMapping("/me")
    public ReservationPage mine(@AuthenticationPrincipal ParkingUserPrincipal user,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return reservationService.mine(user.getUserId(), page, size);
    }

    @GetMapping("/{id}")
    public ReservationResponse findById(@AuthenticationPrincipal ParkingUserPrincipal user, @PathVariable @Positive Long id) {
        return reservationService.mineById(user.getUserId(), id);
    }

    @GetMapping("/operations")
    public ReservationPage operations(@RequestParam OffsetDateTime start, @RequestParam OffsetDateTime end,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return reservationService.operations(start, end, page, size);
    }
    @GetMapping("/availability")
    public Map<String, Boolean> availability(@RequestParam @Positive Long placeId,
            @RequestParam OffsetDateTime start, @RequestParam OffsetDateTime end) {
        return reservationService.availability(placeId, start, end);
    }
    @PostMapping("/quote")
    public ParkingGateway.Quote quote(@AuthenticationPrincipal ParkingUserPrincipal user,
            @Valid @RequestBody ReservationCreateRequest request) {
        return reservationService.estimate(user.getUserId(), request);
    }
    @PostMapping
    public ResponseEntity<ReservationResponse> create(@AuthenticationPrincipal ParkingUserPrincipal user,
            @RequestHeader("Idempotency-Key") UUID key, @Valid @RequestBody ReservationCreateRequest request) {
        return ResponseEntity.status(201).body(reservationService.create(user.getUserId(), request, key));
    }
    @PostMapping("/{id}/cancel")
    public ReservationResponse cancel(@AuthenticationPrincipal ParkingUserPrincipal user, @PathVariable @Positive Long id) {
        return reservationService.cancel(user.getUserId(), id);
    }
    @PostMapping("/{id}/arrival")
    public ReservationResponse arrive(@PathVariable @Positive Long id) { return reservationService.arrive(id); }
    @PostMapping("/{id}/departure")
    public ReservationResponse depart(@PathVariable @Positive Long id) { return reservationService.depart(id); }
}
