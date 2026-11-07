package com.parking.reservations_service.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "reservations")
public class Reservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conducteur_id", nullable = false)
    private Long conducteurId;

    @Column(name = "place_id", nullable = false)
    private Long placeId;

    @Column(name = "debut_prevu", nullable = false)
    private OffsetDateTime debutPrevu;

    @Column(name = "fin_prevue", nullable = false)
    private OffsetDateTime finPrevue;

    @Column(name = "arrivee_reelle")
    private OffsetDateTime arriveeReelle;

    @Column(name = "depart_reel")
    private OffsetDateTime departReel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReservationStatus statut = ReservationStatus.CONFIRMED;

    @Column(name = "montant_estime", precision = 10, scale = 2)
    private BigDecimal montantEstime;

    @Column(name = "montant_final", precision = 10, scale = 2)
    private BigDecimal montantFinal;

    @Column(name = "type_vehicule", length = 32)
    private String typeVehicule;
    @Column(length = 3)
    private String currency;
    @Column(name = "quote_reference", length = 100)
    private String quoteReference;
    @Column(name = "request_key")
    private UUID requestKey;
    @Column(name = "request_fingerprint", length = 64)
    private String requestFingerprint;
    @Column(name = "payment_status", nullable = false, length = 20)
    private String paymentStatus = "NOT_DUE";
    @Column(name = "payment_reference", length = 100)
    private String paymentReference;
    @Column(name = "places_sync_pending", nullable = false)
    private boolean placesSyncPending;
    @Version
    @Column(nullable = false)
    private long version;

    public String getTypeVehicule() { return typeVehicule; }
    public void setTypeVehicule(String value) { typeVehicule = value; }
    public String getCurrency() { return currency; }
    public void setCurrency(String value) { currency = value; }
    public String getQuoteReference() { return quoteReference; }
    public void setQuoteReference(String value) { quoteReference = value; }
    public UUID getRequestKey() { return requestKey; }
    public void setRequestKey(UUID value) { requestKey = value; }
    public String getRequestFingerprint() { return requestFingerprint; }
    public void setRequestFingerprint(String value) { requestFingerprint = value; }
    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String value) { paymentStatus = value; }
    public String getPaymentReference() { return paymentReference; }
    public void setPaymentReference(String value) { paymentReference = value; }
    public boolean isPlacesSyncPending() { return placesSyncPending; }
    public void setPlacesSyncPending(boolean value) { placesSyncPending = value; }
    public long getVersion() { return version; }

    public Reservation() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getConducteurId() {
        return conducteurId;
    }

    public void setConducteurId(Long conducteurId) {
        this.conducteurId = conducteurId;
    }

    public Long getPlaceId() {
        return placeId;
    }

    public void setPlaceId(Long placeId) {
        this.placeId = placeId;
    }

    public OffsetDateTime getDebutPrevu() {
        return debutPrevu;
    }

    public void setDebutPrevu(OffsetDateTime debutPrevu) {
        this.debutPrevu = debutPrevu;
    }

    public OffsetDateTime getFinPrevue() {
        return finPrevue;
    }

    public void setFinPrevue(OffsetDateTime finPrevue) {
        this.finPrevue = finPrevue;
    }

    public OffsetDateTime getArriveeReelle() {
        return arriveeReelle;
    }

    public void setArriveeReelle(OffsetDateTime arriveeReelle) {
        this.arriveeReelle = arriveeReelle;
    }

    public OffsetDateTime getDepartReel() {
        return departReel;
    }

    public void setDepartReel(OffsetDateTime departReel) {
        this.departReel = departReel;
    }

    public ReservationStatus getStatut() {
        return statut;
    }

    public void setStatut(ReservationStatus statut) {
        this.statut = statut;
    }

    public BigDecimal getMontantEstime() {
        return montantEstime;
    }

    public void setMontantEstime(BigDecimal montantEstime) {
        this.montantEstime = montantEstime;
    }

    public BigDecimal getMontantFinal() {
        return montantFinal;
    }

    public void setMontantFinal(BigDecimal montantFinal) {
        this.montantFinal = montantFinal;
    }
}
