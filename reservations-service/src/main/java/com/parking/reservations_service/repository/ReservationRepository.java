package com.parking.reservations_service.repository;

import com.parking.reservations_service.entity.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.parking.reservations_service.entity.ReservationStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReservationRepository extends JpaRepository<Reservation, Long>, JpaSpecificationExecutor<Reservation> {
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

    @Query(value = """
        SELECT r.statut AS statut, count(r.id) AS cnt
        FROM reservations r
        WHERE (CAST(:from AS timestamptz) IS NULL OR r.debut_prevu >= CAST(:from AS timestamptz))
          AND (CAST(:to AS timestamptz) IS NULL OR r.debut_prevu <= CAST(:to AS timestamptz))
        GROUP BY r.statut
        """, nativeQuery = true)
    List<Object[]> countByStatusNative(
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to);

    @Query(value = """
        SELECT
            COALESCE(SUM(CASE WHEN r.statut <> 'CANCELLED' THEN COALESCE(r.booking_paid, 0) + COALESCE(r.extra_paid, 0) ELSE 0 END), 0) AS revenue,
            COUNT(CASE WHEN r.statut = 'COMPLETED' THEN 1 END) AS completed_count,
            COALESCE(AVG(CASE WHEN r.statut = 'COMPLETED' AND r.depart_reel IS NOT NULL AND r.arrivee_reelle IS NOT NULL
                              THEN EXTRACT(EPOCH FROM (r.depart_reel - r.arrivee_reelle)) / 60.0 END), 0.0) AS avg_duration_minutes
        FROM reservations r
        WHERE (CAST(:from AS timestamptz) IS NULL OR r.debut_prevu >= CAST(:from AS timestamptz))
          AND (CAST(:to AS timestamptz) IS NULL OR r.debut_prevu <= CAST(:to AS timestamptz))
        """, nativeQuery = true)
    List<Object[]> computeStatsNative(
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to);
}
