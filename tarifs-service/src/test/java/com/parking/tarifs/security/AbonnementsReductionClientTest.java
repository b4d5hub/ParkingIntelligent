package com.parking.tarifs.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class AbonnementsReductionClientTest {

    private RestClient.Builder restClientBuilder;
    private MockRestServiceServer mockServer;
    private AbonnementsReductionClient client;

    @BeforeEach
    void setUp() {
        restClientBuilder = RestClient.builder().baseUrl("http://subscriptions:8082");
        mockServer = MockRestServiceServer.bindTo(restClientBuilder).build();
        client = new AbonnementsReductionClient(restClientBuilder.build());
    }

    @Test
    void getReductionPourcent_activeSubscription_retourne100Pourcent() {
        mockServer.expect(requestTo("http://subscriptions:8082/internal/subscriptions/discount?userId=42"))
                .andRespond(withSuccess("{\"userId\":\"42\",\"hasActiveSubscription\":true,\"discountPercentage\":100}", MediaType.APPLICATION_JSON));

        BigDecimal reduction = client.getReductionPourcent("42");

        assertThat(reduction).isEqualByComparingTo(new BigDecimal("100"));
        mockServer.verify();
    }

    @Test
    void getReductionPourcent_activeSubscriptionAvecDates_retourne100Pourcent() {
        OffsetDateTime start = OffsetDateTime.parse("2026-11-16T14:00:00Z");
        OffsetDateTime end = OffsetDateTime.parse("2026-11-16T16:00:00Z");
        mockServer.expect(requestTo("http://subscriptions:8082/internal/subscriptions/discount?userId=42&start=2026-11-16T14:00Z&end=2026-11-16T16:00Z"))
                .andRespond(withSuccess("{\"userId\":\"42\",\"hasActiveSubscription\":true,\"discountPercentage\":100}", MediaType.APPLICATION_JSON));

        BigDecimal reduction = client.getReductionPourcent("42", start, end);

        assertThat(reduction).isEqualByComparingTo(new BigDecimal("100"));
        mockServer.verify();
    }

    @Test
    void getReductionPourcent_sansAbonnementActif_retourneZero() {
        mockServer.expect(requestTo("http://subscriptions:8082/internal/subscriptions/discount?userId=42"))
                .andRespond(withSuccess("{\"userId\":\"42\",\"hasActiveSubscription\":false,\"discountPercentage\":0}", MediaType.APPLICATION_JSON));

        BigDecimal reduction = client.getReductionPourcent("42");

        assertThat(reduction).isEqualByComparingTo(BigDecimal.ZERO);
        mockServer.verify();
    }

    @Test
    void getReductionPourcent_abonnementsErreur500_retourneZeroSansException() {
        mockServer.expect(requestTo("http://subscriptions:8082/internal/subscriptions/discount?userId=42"))
                .andRespond(withServerError());

        BigDecimal reduction = client.getReductionPourcent("42");

        assertThat(reduction).isEqualByComparingTo(BigDecimal.ZERO);
        mockServer.verify();
    }

    @Test
    void getReductionPourcent_abonnementsInaccessible_retourneZeroSansException() {
        mockServer.expect(requestTo("http://subscriptions:8082/internal/subscriptions/discount?userId=42"))
                .andRespond(withException(new java.io.IOException("Connection refused")));

        BigDecimal reduction = client.getReductionPourcent("42");

        assertThat(reduction).isEqualByComparingTo(BigDecimal.ZERO);
        mockServer.verify();
    }

    @Test
    void getReductionPourcent_nonConfigure_retourneZeroSansAppel() {
        AbonnementsReductionClient nonConfigClient = new AbonnementsReductionClient("", "", "", 1000, 2000);
        BigDecimal reduction = nonConfigClient.getReductionPourcent("42");

        assertThat(reduction).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void getReductionPourcent_conducteurIdVide_retourneZero() {
        BigDecimal reduction = client.getReductionPourcent("");

        assertThat(reduction).isEqualByComparingTo(BigDecimal.ZERO);
    }
}
