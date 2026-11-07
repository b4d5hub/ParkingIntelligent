package com.parking.reservations_service.repository;

import com.parking.reservations_service.entity.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.parking.reservations_service.entity.ReservationStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    Page<Reservation> findByConducteurId(Long conducteurId, Pageable pageable);
    Optional<Reservation> findByIdAndConducteurId(Long id, Long conducteurId);
    Optional<Reservation> findByConducteurIdAndRequestKey(Long conducteurId, UUID requestKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Reservation r where r.id = :id")
    Optional<Reservation> lockById(Long id);

    @Query("""
        select count(r) from Reservation r where r.placeId = :placeId
        and r.statut in :statuses and r.debutPrevu < :end and r.finPrevue > :start
        """)
    long countOverlaps(Long placeId, OffsetDateTime start, OffsetDateTime end, List<ReservationStatus> statuses);

    boolean existsByPlaceIdAndStatut(Long placeId, ReservationStatus statut);

    @Query("""
        select r from Reservation r where (r.debutPrevu < :end and r.finPrevue > :start)
        or r.statut = com.parking.reservations_service.entity.ReservationStatus.IN_PROGRESS
        """)
    Page<Reservation> findOperations(OffsetDateTime start, OffsetDateTime end, Pageable pageable);

    @Query("select r.placeId from Reservation r where r.id = :id")
    Optional<Long> findPlaceId(Long id);

    @Query("select r.id from Reservation r where r.statut = com.parking.reservations_service.entity.ReservationStatus.CONFIRMED and r.debutPrevu < :deadline order by r.id")
    List<Long> findNoShowIds(OffsetDateTime deadline, Pageable pageable);
}
