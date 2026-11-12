package com.parking.tarifs.repository;

import com.parking.tarifs.entity.TarifHoraire;
import com.parking.tarifs.exception.TarifManquantException;
import com.parking.tarifs.service.TarifRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests d'intégration de persistance exécutés UNIQUEMENT sur conteneur PostgreSQL jetable
 * (créé par le script {@code scripts/Test-Tarifs.ps1}).
 * <p>
 * Ne JAMAIS exécuter contre la base de développement partagée.
 */
@SpringBootTest
@Transactional
@EnabledIfEnvironmentVariable(named = "PARKING_INTEGRATION", matches = "true")
@DisplayName("Tests d'intégration PostgreSQL pour TarifRepository")
class TarifPostgresTests {

    @Autowired
    private TarifRepository tarifRepository;

    @Autowired
    private TarifHoraireJpaRepository jpaRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Le tarif initial de 10.00 DH/h issu du seed SQL est correctement lu")
    void tarifInitial_estBienLu() {
        BigDecimal tarif = tarifRepository.lireTarifCourant();
        assertNotNull(tarif);
        assertEquals(new BigDecimal("10.00"), tarif);
    }

    @Test
    @DisplayName("L'enregistrement d'un nouveau tarif horaire met à jour le tarif en vigueur avec l'auteur")
    void enregistrerNouveauTarif_metAJourTarifCourant() {
        tarifRepository.enregistrerNouveauTarif(new BigDecimal("15.50"), "admin-integ");

        BigDecimal tarif = tarifRepository.lireTarifCourant();
        assertEquals(new BigDecimal("15.50"), tarif);

        // Vérification de la traçabilité en base
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM tarif_horaire WHERE cree_par = 'admin-integ' AND prix_dh = 15.50",
                Integer.class
        );
        assertEquals(1, count);
    }

    @Test
    @DisplayName("Un tarif futur n'est pas pris en compte pour le tarif courant")
    void tarifFutur_estIgnorePourTarifCourant() {
        OffsetDateTime futur = OffsetDateTime.now(ZoneOffset.UTC).plusDays(7);
        jpaRepository.save(new TarifHoraire(new BigDecimal("99.00"), futur, "admin-futur", OffsetDateTime.now(ZoneOffset.UTC)));

        BigDecimal tarif = tarifRepository.lireTarifCourant();
        assertNotEquals(new BigDecimal("99.00"), tarif);
    }
}

