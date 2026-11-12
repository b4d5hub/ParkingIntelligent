package com.parking.tarifs.repository;

import com.parking.tarifs.entity.TarifHoraire;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Interface Spring Data JPA pour la table {@code tarif_horaire}.
 */
@Repository
public interface TarifHoraireJpaRepository extends JpaRepository<TarifHoraire, Long> {

    /**
     * Récupère le tarif en vigueur le plus récent dont la date de validité
     * est inférieure ou égale à {@code maintenant} (exclut les tarifs futurs).
     */
    Optional<TarifHoraire> findFirstByValableAPartirLessThanEqualOrderByValableAPartirDescIdDesc(
            OffsetDateTime maintenant);
}
