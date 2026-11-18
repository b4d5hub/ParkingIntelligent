package com.parking.tarifs.service;

import com.parking.tarifs.dto.TarifHoraireHistoryItem;
import com.parking.tarifs.dto.TarifHoraireHistoryPage;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/**
 * Implémentation en mémoire de {@link TarifRepository} destinée aux tests unitaires.
 * Ne nécessite aucune connexion à une base de données ni contexte Spring.
 */
public class InMemoryTarifRepository implements TarifRepository {

    private BigDecimal tarifCourant;
    private final List<TarifHoraireHistoryItem> historique = new ArrayList<>();
    private long seq = 1L;

    public InMemoryTarifRepository() {
        this(new BigDecimal("10.00"));
    }

    public InMemoryTarifRepository(BigDecimal tarifInitial) {
        this.tarifCourant = tarifInitial != null
                ? tarifInitial.setScale(2, RoundingMode.HALF_UP)
                : new BigDecimal("10.00");
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        historique.add(new TarifHoraireHistoryItem(seq++, this.tarifCourant, now, "system", now));
    }

    @Override
    public BigDecimal lireTarifCourant() {
        return tarifCourant;
    }

    @Override
    public void enregistrerNouveauTarif(BigDecimal nouveauPrix, String creePar) {
        if (nouveauPrix == null || nouveauPrix.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Le prix doit être strictement positif");
        }
        this.tarifCourant = nouveauPrix.setScale(2, RoundingMode.HALF_UP);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        historique.add(0, new TarifHoraireHistoryItem(seq++, this.tarifCourant, now, creePar, now));
    }

    @Override
    public TarifHoraireHistoryPage consulterHistorique(int page, int size) {
        int start = page * size;
        int end = Math.min(start + size, historique.size());
        List<TarifHoraireHistoryItem> content = (start >= historique.size()) ? List.of() : historique.subList(start, end);
        int totalPages = (int) Math.ceil((double) historique.size() / size);
        return new TarifHoraireHistoryPage(content, page, size, historique.size(), totalPages);
    }
}
