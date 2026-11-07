package com.parking.places_service.repository;

import com.parking.places_service.entity.Place;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface PlaceRepository extends JpaRepository<Place, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Place p where p.id = :id")
    Optional<Place> findByIdForUpdate(@Param("id") Long id);
}