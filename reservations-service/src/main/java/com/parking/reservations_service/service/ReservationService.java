package com.parking.reservations_service.service;

import com.parking.reservations_service.entity.*;
import com.parking.reservations_service.dto.*;
import com.parking.reservations_service.integration.ParkingGateway;
import com.parking.reservations_service.repository.ReservationRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.core.env.Environment;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.*;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class ReservationService {
    private static final List<ReservationStatus> ACTIVE = List.of(ReservationStatus.CONFIRMED, ReservationStatus.IN_PROGRESS);
    private final ReservationRepository repository;
    private final PlaceCommandService commands;
    private final ParkingGateway gateway;
    private final Clock clock;

    public ReservationService(ReservationRepository repository, PlaceCommandService commands, ParkingGateway gateway,
                              Clock clock, Environment environment) {
        this.repository = repository; this.commands = commands; this.gateway = gateway;
        this.clock = clock;
    }

    public ReservationPage mine(long driverId, int page, int size) {
        return ReservationPage.from(repository.findByConducteurId(driverId, paging(page, size)));
    }

    public ReservationResponse mineById(long driverId, long id) {
        return ReservationResponse.fromEntity(repository.findByIdAndConducteurId(id, driverId)
                .orElseThrow(ReservationFailure::missing));
    }

    public ReservationPage operations(OffsetDateTime start, OffsetDateTime end, int page, int size) {
        interval(start, end);
        if (Duration.between(start, end).compareTo(Duration.ofDays(31)) > 0) { throw bad("La période dépasse 31 jours"); }
        return ReservationPage.from(repository.findOperations(start, end, paging(page, size)));
    }

    public Map<String, Boolean> availability(long placeId, OffsetDateTime start, OffsetDateTime end) {
        interval(start, end);
        var place = gateway.place(placeId);
        return Map.of("available", place.enService() && repository.countOverlaps(placeId, start, end, ACTIVE) == 0);
    }

    public ParkingGateway.Quote estimate(long driverId, ReservationCreateRequest request) {
        validateBooking(request);
        requireServiceable(request.placeId());
        return validQuote(gateway.estimate(priceRequest(driverId, request, null, null, null)));
    }

    @Transactional
    public ReservationResponse create(long driverId, ReservationCreateRequest request, UUID key) {
        String fingerprint = fingerprint(request);
        commands.lockPlace(request.placeId());
        var existing = repository.findByConducteurIdAndRequestKey(driverId, key);
        if (existing.isPresent()) {
            if (!fingerprint.equals(existing.get().getRequestFingerprint())) {
                throw ReservationFailure.conflict("Clé déjà utilisée pour une autre demande");
            }
            return ReservationResponse.fromEntity(existing.get());
        }
        validateBooking(request);
        requireServiceable(request.placeId());
        if (repository.countOverlaps(request.placeId(), request.debutPrevu(), request.finPrevue(), ACTIVE) > 0) {
            throw ReservationFailure.conflict("Un autre créneau chevauche cette demande");
        }
        var quote = validQuote(gateway.estimate(priceRequest(driverId, request, null, null, null)));
        Reservation reservation = new Reservation();
        reservation.setConducteurId(driverId); reservation.setPlaceId(request.placeId());
        reservation.setDebutPrevu(request.debutPrevu()); reservation.setFinPrevue(request.finPrevue());
        reservation.setTypeVehicule(request.typeVehicule().toUpperCase(Locale.ROOT));
        reservation.setCurrency(quote.currency()); reservation.setQuoteReference(quote.reference());
        reservation.setMontantEstime(quote.amount()); reservation.setRequestKey(key);
        reservation.setRequestFingerprint(fingerprint);
        reservation.setBookingPaid(quote.amount());
        reservation.setPaymentStatus("PAID"); reservation.setPaymentReference("SIM-" + UUID.randomUUID());
        return ReservationResponse.fromEntity(repository.saveAndFlush(reservation));
    }

    @Transactional
    public ReservationResponse cancel(long driverId, long id) {
        Reservation reservation = repository.lockById(id).orElseThrow(ReservationFailure::missing);
        if (!Objects.equals(reservation.getConducteurId(), driverId)) { throw ReservationFailure.missing(); }
        if (reservation.getStatut() == ReservationStatus.CANCELLED) { return ReservationResponse.fromEntity(reservation); }
        if (reservation.getStatut() != ReservationStatus.CONFIRMED || !OffsetDateTime.now(clock).isBefore(reservation.getDebutPrevu())) {
            throw ReservationFailure.conflict("Annulation autorisée uniquement avant le début d'une réservation confirmée");
        }
        reservation.setStatut(ReservationStatus.CANCELLED);
        return ReservationResponse.fromEntity(reservation);
    }

    @Transactional
    public ReservationResponse arrive(long id) {
        long placeId = repository.findPlaceId(id).orElseThrow(ReservationFailure::missing);
        commands.lockPlace(placeId);
        Reservation reservation = repository.lockById(id).orElseThrow(ReservationFailure::missing);
        if (reservation.getStatut() == ReservationStatus.IN_PROGRESS) { return ReservationResponse.fromEntity(reservation); }
        if (reservation.getStatut() != ReservationStatus.CONFIRMED) { throw ReservationFailure.conflict("Cette réservation ne peut pas démarrer"); }
        OffsetDateTime now = OffsetDateTime.now(clock);
        if (now.isBefore(reservation.getDebutPrevu())) { throw ReservationFailure.conflict("Le créneau n'a pas encore commencé"); }
        if (!now.isBefore(reservation.getFinPrevue())) {
            throw ReservationFailure.conflict("Le délai d'arrivée est dépassé");
        }
        var place = requireServiceable(reservation.getPlaceId());
        if (place.occupee() || commands.hasPending(reservation.getPlaceId())
                || repository.existsByPlaceIdAndStatut(reservation.getPlaceId(), ReservationStatus.IN_PROGRESS)) {
            throw ReservationFailure.conflict("Une arrivée est déjà enregistrée sur cette place");
        }
        reservation.setArriveeReelle(now); reservation.setStatut(ReservationStatus.IN_PROGRESS);
        reservation.setPlacesSyncPending(true);
        commands.enqueue(id, reservation.getPlaceId(), "OCCUPY");
        return ReservationResponse.fromEntity(reservation);
    }

    @Transactional
    public ReservationResponse depart(long id) {
        Reservation reservation = repository.lockById(id).orElseThrow(ReservationFailure::missing);
        if (reservation.getStatut() == ReservationStatus.COMPLETED) { return ReservationResponse.fromEntity(reservation); }
        if (reservation.getStatut() != ReservationStatus.IN_PROGRESS || reservation.getArriveeReelle() == null) {
            throw ReservationFailure.conflict("Aucune arrivée active n'est enregistrée");
        }
        OffsetDateTime now = OffsetDateTime.now(clock);
        if (now.isBefore(reservation.getArriveeReelle())) { throw ReservationFailure.conflict("Horloge incohérente"); }
        if (reservation.getBookingPaid() == null) {
            // Preserve the original agreement for historical, unpaid bookings.
            var request = new ReservationCreateRequest(reservation.getPlaceId(), reservation.getDebutPrevu(),
                    reservation.getFinPrevue(), reservation.getTypeVehicule());
            var quote = validQuote(gateway.finalAmount(priceRequest(reservation.getConducteurId(), request,
                    reservation.getArriveeReelle(), now, reservation.getQuoteReference())));
            requireCurrency(reservation, quote);
            reservation.setMontantFinal(quote.amount()); reservation.setCurrency(quote.currency());
            reservation.setPaymentReference("SIM-" + UUID.randomUUID());
        } else {
            BigDecimal extra = new BigDecimal("0.00");
            if (now.isAfter(reservation.getFinPrevue())) {
                // Charge only the interval beyond the paid slot, even after a late arrival.
                var request = new ReservationCreateRequest(reservation.getPlaceId(), reservation.getFinPrevue(),
                        now, reservation.getTypeVehicule());
                var quote = validQuote(gateway.finalAmount(priceRequest(reservation.getConducteurId(), request,
                        reservation.getFinPrevue(), now, null)));
                requireCurrency(reservation, quote);
                extra = quote.amount();
            }
            BigDecimal total = reservation.getBookingPaid().add(extra);
            if (total.precision() > 10) {
                throw new ReservationFailure(HttpStatus.BAD_GATEWAY, "INVALID_PARTNER_RESPONSE", "Montant total trop élevé");
            }
            reservation.setExtraPaid(extra); reservation.setMontantFinal(total);
            if (extra.signum() > 0) { reservation.setExtraPaymentReference("SIM-" + UUID.randomUUID()); }
        }
        reservation.setDepartReel(now); reservation.setStatut(ReservationStatus.COMPLETED);
        reservation.setPaymentStatus("PAID");
        reservation.setPlacesSyncPending(true);
        commands.enqueue(id, reservation.getPlaceId(), "RELEASE");
        return ReservationResponse.fromEntity(reservation);
    }

    @Transactional
    public int expireNoShows() {
        // The paid slot stays reserved until its planned end, regardless of lateness.
        return 0;
    }

    private void requireCurrency(Reservation reservation, ParkingGateway.Quote quote) {
        if (reservation.getCurrency() != null && !reservation.getCurrency().equals(quote.currency())) {
            throw new ReservationFailure(HttpStatus.BAD_GATEWAY, "INVALID_PARTNER_RESPONSE", "Devise incohérente");
        }
    }
    private PageRequest paging(int page, int size) {
        if (page < 0 || size < 1 || size > 100) { throw bad("Pagination invalide"); }
        return PageRequest.of(page, size, Sort.by("debutPrevu").descending().and(Sort.by("id").descending()));
    }
    private void validateBooking(ReservationCreateRequest request) {
        interval(request.debutPrevu(), request.finPrevue());
        if (!request.debutPrevu().isAfter(OffsetDateTime.now(clock))) { throw bad("Le début doit être dans le futur"); }
    }
    private void interval(OffsetDateTime start, OffsetDateTime end) {
        if (start == null || end == null || !end.isAfter(start)) { throw bad("La fin doit être après le début"); }
    }
    private ParkingGateway.Place requireServiceable(long id) {
        var place = gateway.place(id);
        if (!place.enService()) { throw ReservationFailure.conflict("Place hors service"); }
        return place;
    }
    private ParkingGateway.Quote validQuote(ParkingGateway.Quote quote) {
        try {
            if (quote == null || quote.amount() == null || quote.currency() == null || quote.amount().signum() < 0
                    || quote.reference() == null || quote.reference().isBlank() || quote.reference().length() > 100) { throw new IllegalArgumentException(); }
            Currency.getInstance(quote.currency());
            BigDecimal amount = quote.amount().setScale(2, RoundingMode.UNNECESSARY);
            if (amount.precision() > 10) { throw new IllegalArgumentException(); }
            return new ParkingGateway.Quote(amount, quote.currency(), quote.reference());
        } catch (IllegalArgumentException | ArithmeticException exception) {
            throw new ReservationFailure(HttpStatus.BAD_GATEWAY, "INVALID_PARTNER_RESPONSE", "Montant partenaire invalide");
        }
    }
    private ParkingGateway.PriceRequest priceRequest(long driverId, ReservationCreateRequest request,
            OffsetDateTime arrival, OffsetDateTime departure, String reference) {
        return new ParkingGateway.PriceRequest(Long.toString(driverId), request.placeId().toString(),
                request.typeVehicule().toUpperCase(Locale.ROOT), request.debutPrevu(), request.finPrevue(), arrival, departure, reference, false);
    }
    private String fingerprint(ReservationCreateRequest request) {
        String text = request.placeId() + "|" + request.debutPrevu().toInstant() + "|" + request.finPrevue().toInstant()
                + "|" + request.typeVehicule().toUpperCase(Locale.ROOT);
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
    private ReservationFailure bad(String message) { return new ReservationFailure(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", message); }
}
