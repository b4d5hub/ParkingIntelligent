package com.parking.places_service.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI placesOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Service Places")
                .version("1.0")
                .description("Gestion des places du parking : consultation, administration, "
                        + "occupation et libération par le service Réservations."));
    }
}