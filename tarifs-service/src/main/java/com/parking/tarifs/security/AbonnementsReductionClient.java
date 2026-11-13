package com.parking.tarifs.security;

import com.parking.tarifs.exception.ServiceIndisponibleException;
import com.parking.tarifs.service.ReductionProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;

import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;

/**
 * Client HTTP vers le service Abonnements pour obtenir la réduction d'un conducteur.
 * <p>
 * ⚠️ Le service Abonnements (Kamal) n'est pas encore implémenté.
 * Cette implémentation lève systématiquement {@link ServiceIndisponibleException}
 * jusqu'à ce que le contrat Abonnements soit confirmé et le service déployé.
 * <p>
 * Toute intégration doit être validée avec Kamal avant d'activer cet appel.
 * Ne jamais simuler 0 % de réduction en production — toujours fail-closed.
 */
@Component
public class AbonnementsReductionClient implements ReductionProvider {

    // ── BLOCKER : Abonnements non encore implémenté ───────────────────────────
    // Le dossier abonnements-service n'existe pas encore dans le dépôt.
    // Dès que Kamal publie son contrat, remplacer ce stub par un appel HTTP réel.

    @Override
    public BigDecimal getReductionPourcent(String conducteurId) {
        throw new ServiceIndisponibleException(
                "Le service Abonnements n'est pas encore disponible. " +
                "Contacter Kamal pour obtenir le contrat de l'API de réduction.");
    }
}

