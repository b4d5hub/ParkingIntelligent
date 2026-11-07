package com.parking.reservations_service.dto;

import java.util.List;
import org.springframework.data.domain.Page;
import com.parking.reservations_service.entity.Reservation;

public record ReservationPage(List<ReservationResponse> items, long total, int page, int size) {
    public static ReservationPage from(Page<Reservation> result) {
        return new ReservationPage(result.map(ReservationResponse::fromEntity).getContent(),
                result.getTotalElements(), result.getNumber(), result.getSize());
    }
}
