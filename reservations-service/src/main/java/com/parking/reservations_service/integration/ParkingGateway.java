package com.parking.reservations_service.integration;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
public interface ParkingGateway {
    Place place(long placeId);
    Quote estimate(PriceRequest request);
    Quote finalAmount(PriceRequest request);
    void changeOccupancy(long placeId, long reservationId, String operation, String operationKey);
    record Place(String id, boolean enService, boolean occupee) { }
    record Quote(BigDecimal amount, String currency, String reference) { }
    record PriceRequest(String conducteurId, String placeId, String typeVehicule,
        OffsetDateTime debutPrevu, OffsetDateTime finPrevue, OffsetDateTime arriveeReelle,
        OffsetDateTime departReel, String quoteReference, boolean overstayPenalty) { }
}
