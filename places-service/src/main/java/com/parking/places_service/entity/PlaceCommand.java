package com.parking.places_service.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "place_command")
public class PlaceCommand {

    @Id
    @Column(name = "idempotency_key", length = 100)
    private String idempotencyKey;

    @Column(name = "place_id", nullable = false)
    private Long placeId;

    @Column(nullable = false, length = 10)
    private String operation;

    @Column(name = "reservation_id", nullable = false)
    private Long reservationId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    protected PlaceCommand() {
    }

    public PlaceCommand(String idempotencyKey, Long placeId, String operation, Long reservationId) {
        this.idempotencyKey = idempotencyKey;
        this.placeId = placeId;
        this.operation = operation;
        this.reservationId = reservationId;
    }
}