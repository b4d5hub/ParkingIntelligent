package com.parking.tarifs;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Point d'entrée de l'application Tarifs.
 * Dépendances minimales : spring-boot-starter uniquement.
 * Pas de base de données, pas de serveur web pour l'instant.
 */
@SpringBootApplication
public class TarifsServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(TarifsServiceApplication.class, args);
    }
}
