package com.parking.tarifs.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Entité représentant une ligne d'historique du tarif horaire.
 * Mappée sur la table commune {@code tarif_horaire}.
 */
@Entity
@Table(name = "tarif_horaire")
public class TarifHoraire {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "prix_dh", nullable = false, precision = 10, scale = 2)
    private BigDecimal prixDh;

    @Column(name = "valable_a_partir", nullable = false)
    private OffsetDateTime valableAPartir;

    @Column(name = "cree_par", nullable = false)
    private String creePar;

    @Column(name = "cree_le", nullable = false)
    private OffsetDateTime creeLe;

    public TarifHoraire() {
    }

    public TarifHoraire(BigDecimal prixDh, OffsetDateTime valableAPartir, String creePar, OffsetDateTime creeLe) {
        this.prixDh = prixDh;
        this.valableAPartir = valableAPartir;
        this.creePar = creePar;
        this.creeLe = creeLe;
    }

    public Long getId() {
        return id;
    }

    public BigDecimal getPrixDh() {
        return prixDh;
    }

    public void setPrixDh(BigDecimal prixDh) {
        this.prixDh = prixDh;
    }

    public OffsetDateTime getValableAPartir() {
        return valableAPartir;
    }

    public void setValableAPartir(OffsetDateTime valableAPartir) {
        this.valableAPartir = valableAPartir;
    }

    public String getCreePar() {
        return creePar;
    }

    public void setCreePar(String creePar) {
        this.creePar = creePar;
    }

    public OffsetDateTime getCreeLe() {
        return creeLe;
    }

    public void setCreeLe(OffsetDateTime creeLe) {
        this.creeLe = creeLe;
    }
}
