package com.parking.tarifs.repository;

import com.parking.tarifs.entity.TarifHoraire;
import com.parking.tarifs.service.TarifRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * Implémentation de production de {@link TarifRepository} s'appuyant sur PostgreSQL via JPA.
 */
@Repository
public class JpaTarifRepository implements TarifRepository {

    private static final BigDecimal TARIF_PAR_DEFAUT = new BigDecimal("10.00");

    private final TarifHoraireJpaRepository jpaRepository;

    public JpaTarifRepository(TarifHoraireJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal lireTarifCourant() {
        return jpaRepository.findFirstByOrderByValableAPartirDescIdDesc()
                .map(TarifHoraire::getPrixDh)
                .orElse(TARIF_PAR_DEFAUT);
    }

    @Override
    @Transactional
    public void enregistrerNouveauTarif(BigDecimal nouveauPrix, String creePar) {
        OffsetDateTime maintenant = OffsetDateTime.now(ZoneOffset.UTC);
        TarifHoraire entite = new TarifHoraire(nouveauPrix, maintenant, creePar, maintenant);
        jpaRepository.save(entite);
    }
}
