package com.parking.tarifs;

import com.parking.tarifs.service.TarifRepository;
import com.parking.tarifs.service.TarifService;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

/**
 * Point d'entrée de l'application Tarifs.
 */
@SpringBootApplication
public class TarifsServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(TarifsServiceApplication.class, args);
    }

    /**
     * Instancie la classe métier pure {@link TarifService} avec son implémentation de persistance.
     */
    @Bean
    public TarifService tarifService(TarifRepository repository) {
        return new TarifService(repository);
    }
}
