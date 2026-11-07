package com.parking.tarifs.repository;

import com.parking.tarifs.entity.TarifHoraire;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Interface Spring Data JPA pour la table {@code tarif_horaire}.
 */
@Repository
public interface TarifHoraireJpaRepository extends JpaRepository<TarifHoraire, Long> {

    /**
     * Récupère le tarif le plus récent selon sa date de validité et son identifiant.
     */
    Optional<TarifHoraire> findFirstByOrderByValableAPartirDescIdDesc();
}
