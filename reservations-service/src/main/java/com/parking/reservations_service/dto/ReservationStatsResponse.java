package com.parking.reservations_service.dto;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Réponse pour les statistiques des réservations (GET /api/reservations/admin/stats).
 */
public record ReservationStatsResponse(
        Map<String, Long> totalsByStatus,
        BigDecimal revenue,
        long countCompleted,
        long completedCount,
        Double averageDurationMinutes,
        Double averageDurationSeconds,
        Double averageDuration
) {
}
