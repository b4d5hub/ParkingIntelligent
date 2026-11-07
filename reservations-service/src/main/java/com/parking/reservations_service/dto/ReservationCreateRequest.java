package com.parking.reservations_service.dto;

import java.time.OffsetDateTime;
import jakarta.validation.constraints.*;

public record ReservationCreateRequest(
        @NotNull @Positive Long placeId,
        @NotNull OffsetDateTime debutPrevu,
        @NotNull OffsetDateTime finPrevue,
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{1,32}") String typeVehicule) {
}
