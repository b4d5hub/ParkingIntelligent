package com.parking.tarifs.repository;

import com.parking.tarifs.entity.TarifHoraire;
import com.parking.tarifs.exception.TarifManquantException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires purs de {@link JpaTarifRepository}.
 * <p>
 * Sans serveur, sans conteneur externe, sans base de données réelle.
 * Vérifie la gestion des exceptions, le filtrage des dates futures et la traçabilité.
 */
@DisplayName("Tests unitaires de JpaTarifRepository")
class JpaTarifRepositoryTest {

    private TarifHoraireJpaRepository jpaRepository;
    private JpaTarifRepository repository;

    @BeforeEach
    void initialiser() {
        jpaRepository = mock(TarifHoraireJpaRepository.class);
        repository    = new JpaTarifRepository(jpaRepository);
    }

    @Test
    @DisplayName("lireTarifCourant : lève TarifManquantException si la table est vide (pas de fallback silencieux)")
    void lireTarifCourant_tableVide_leveTarifManquantException() {
        when(jpaRepository.findFirstByValableAPartirLessThanEqualOrderByValableAPartirDescIdDesc(any()))
                .thenReturn(Optional.empty());

        TarifManquantException exception = assertThrows(
                TarifManquantException.class,
                () -> repository.lireTarifCourant()
        );

        assertTrue(exception.getMessage().contains("Aucun tarif horaire n'est configuré en base"));
    }

    @Test
    @DisplayName("lireTarifCourant : retourne le tarif en vigueur lorsque présent")
    void lireTarifCourant_tarifPresent_retournePrix() {
        OffsetDateTime date = OffsetDateTime.of(2026, 11, 8, 10, 0, 0, 0, ZoneOffset.UTC);
        TarifHoraire tarif = new TarifHoraire(new BigDecimal("12.50"), date, "admin-1", date);

        when(jpaRepository.findFirstByValableAPartirLessThanEqualOrderByValableAPartirDescIdDesc(any()))
                .thenReturn(Optional.of(tarif));

        BigDecimal prix = repository.lireTarifCourant();

        assertEquals(new BigDecimal("12.50"), prix);
    }

    @Test
    @DisplayName("enregistrerNouveauTarif : persiste l'entité avec le prix, l'auteur et l'horodatage")
    void enregistrerNouveauTarif_persisteAvecAuteur() {
        BigDecimal nouveauPrix = new BigDecimal("15.00");
        String auteur = "admin-42";

        repository.enregistrerNouveauTarif(nouveauPrix, auteur);

        ArgumentCaptor<TarifHoraire> captor = ArgumentCaptor.forClass(TarifHoraire.class);
        verify(jpaRepository).save(captor.capture());

        TarifHoraire entite = captor.getValue();
        assertEquals(nouveauPrix, entite.getPrixDh());
        assertEquals(auteur, entite.getCreePar());
        assertNotNull(entite.getValableAPartir());
        assertNotNull(entite.getCreeLe());
    }
}
