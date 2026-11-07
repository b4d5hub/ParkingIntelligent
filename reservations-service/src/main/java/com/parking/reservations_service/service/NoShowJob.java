package com.parking.reservations_service.service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
@Component
public class NoShowJob {
    private final ReservationService reservations;
    public NoShowJob(ReservationService reservations) { this.reservations = reservations; }
    @Scheduled(fixedDelayString = "${parking.no-show-scan-ms:60000}")
    public void expire() { reservations.expireNoShows(); }
}
