package com.parking.reservations_service.service;

import org.springframework.http.HttpStatus;

public class ReservationFailure extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    public ReservationFailure(HttpStatus status, String code, String message) {
        super(message); this.status = status; this.code = code;
    }
    public HttpStatus status() { return status; }
    public String code() { return code; }
    public static ReservationFailure conflict(String message) {
        return new ReservationFailure(HttpStatus.CONFLICT, "RESERVATION_CONFLICT", message);
    }
    public static ReservationFailure missing() {
        return new ReservationFailure(HttpStatus.NOT_FOUND, "RESERVATION_NOT_FOUND", "Réservation introuvable");
    }
}
