package com.parking.tarifs.dto;

import java.util.List;

/**
 * Réponse paginée de l'historique du tarif horaire (GET /api/tarifs/hourly/history).
 *
 * @param content       liste des entrées de tarif
 * @param page          numéro de la page (0-based)
 * @param size          taille de la page demandée
 * @param totalElements nombre total d'entrées
 * @param totalPages    nombre total de pages
 */
public record TarifHoraireHistoryPage(
        List<TarifHoraireHistoryItem> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}
