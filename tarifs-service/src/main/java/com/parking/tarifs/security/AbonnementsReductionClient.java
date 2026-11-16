package com.parking.tarifs.security;

import com.parking.tarifs.service.ReductionProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.OffsetDateTime;

/**
 * Client HTTP vers le service Abonnements pour obtenir la réduction d'un conducteur.
 * Si le service Abonnements est inaccessible, lent ou retourne une erreur,
 * bascule vers 0 % de réduction (plein tarif) et consigne un avertissement.
 */
@Component
public class AbonnementsReductionClient implements ReductionProvider {

    private static final Logger log = LoggerFactory.getLogger(AbonnementsReductionClient.class);

    public record DiscountResponse(String userId, Boolean hasActiveSubscription, BigDecimal discountPercentage) {}

    private final RestClient restClient;

    public AbonnementsReductionClient(
            @Value("${tarifs.subscriptions.service.url:http://subscriptions:8082}") String subscriptionsServiceUrl,
            @Value("${tarifs.subscriptions.api.user:}") String subscriptionsUser,
            @Value("${tarifs.subscriptions.api.password:}") String subscriptionsPassword,
            @Value("${tarifs.subscriptions.connect-timeout-ms:1000}") long connectTimeoutMs,
            @Value("${tarifs.subscriptions.read-timeout-ms:2000}") long readTimeoutMs) {

        if (subscriptionsServiceUrl.isBlank() || subscriptionsUser.isBlank() || subscriptionsPassword.isBlank()) {
            this.restClient = null;
            return;
        }

        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofMillis(connectTimeoutMs)).build());
        factory.setReadTimeout(Duration.ofMillis(readTimeoutMs));

        this.restClient = RestClient.builder()
                .baseUrl(subscriptionsServiceUrl)
                .requestFactory(factory)
                .defaultHeaders(h -> h.setBasicAuth(subscriptionsUser, subscriptionsPassword))
                .build();
    }

    /**
     * Constructeur dédié aux tests unitaires.
     */
    public AbonnementsReductionClient(RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    public BigDecimal getReductionPourcent(String conducteurId) {
        return getReductionPourcent(conducteurId, null, null);
    }

    public BigDecimal getReductionPourcent(String conducteurId, OffsetDateTime debut, OffsetDateTime fin) {
        if (conducteurId == null || conducteurId.isBlank()) {
            return BigDecimal.ZERO;
        }

        if (restClient == null) {
            log.warn("Abonnements non configuré (URL ou identifiants manquants). Application du tarif plein (0 % de réduction) pour conducteurId={}", conducteurId);
            return BigDecimal.ZERO;
        }

        try {
            DiscountResponse response = restClient.get()
                    .uri(uriBuilder -> {
                        uriBuilder.path("/internal/subscriptions/discount")
                                .queryParam("userId", conducteurId);
                        if (debut != null) {
                            uriBuilder.queryParam("start", debut.toString());
                        }
                        if (fin != null) {
                            uriBuilder.queryParam("end", fin.toString());
                        }
                        return uriBuilder.build();
                    })
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(DiscountResponse.class);

            if (response == null) {
                log.warn("Réponse vide d'Abonnements pour conducteurId={}. Repli sur 0 % de réduction.", conducteurId);
                return BigDecimal.ZERO;
            }

            if (Boolean.TRUE.equals(response.hasActiveSubscription())) {
                return response.discountPercentage() != null
                        ? response.discountPercentage()
                        : new BigDecimal("100");
            }

            return BigDecimal.ZERO;
        } catch (Exception ex) {
            log.warn("Impossible d'obtenir la réduction auprès d'Abonnements pour conducteurId={} : {}. Repli sur 0 % de réduction.",
                    conducteurId, ex.getMessage());
            return BigDecimal.ZERO;
        }
    }
}
