package com.parking.reservations_service.dto;

import com.parking.reservations_service.entity.Reservation;
import com.parking.reservations_service.entity.ReservationStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record ReservationResponse(
        String id,
        String conducteurId,
        String placeId,
        OffsetDateTime debutPrevu,
        OffsetDateTime finPrevue,
        OffsetDateTime arriveeReelle,
        OffsetDateTime departReel,
        ReservationStatus statut,
        BigDecimal montantEstime,
        BigDecimal montantFinal,
        String typeVehicule,
        String currency,
        String paymentStatus,
        String paymentReference,
        boolean placesSyncPending
) {
    public static ReservationResponse fromEntity(Reservation reservation) {
        return new ReservationResponse(
                reservation.getId().toString(),
                reservation.getConducteurId().toString(),
                reservation.getPlaceId().toString(),
                reservation.getDebutPrevu(),
                reservation.getFinPrevue(),
                reservation.getArriveeReelle(),
                reservation.getDepartReel(),
                reservation.getStatut(),
                reservation.getMontantEstime(),
                reservation.getMontantFinal(),
                reservation.getTypeVehicule(), reservation.getCurrency(), reservation.getPaymentStatus(),
                reservation.getPaymentReference(), reservation.isPlacesSyncPending()
        );
    }
}
