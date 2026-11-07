package com.parking.reservations_service.service;
import com.parking.reservations_service.integration.ParkingGateway;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
@Service
public class PlaceCommandService {
    private final JdbcTemplate jdbc;
    private final ParkingGateway gateway;
    private final TransactionTemplate transaction;
    private final Environment environment;
    private final Clock clock;
    public PlaceCommandService(JdbcTemplate jdbc, ParkingGateway gateway, PlatformTransactionManager manager, Environment environment, Clock clock) {
        this.jdbc = jdbc; this.gateway = gateway; this.transaction = new TransactionTemplate(manager); this.environment = environment; this.clock = clock;
    }
    public void lockPlace(long id) {
        jdbc.update("insert into reservation_place_guards(place_id) values (?) on conflict do nothing", id);
        jdbc.queryForObject("select place_id from reservation_place_guards where place_id = ? for update", Long.class, id);
    }
    public void enqueue(long reservationId, long placeId, String operation) {
        jdbc.update("insert into reservation_place_commands(reservation_id, place_id, operation, operation_key) values (?, ?, ?, ?) on conflict(operation_key) do nothing",
            reservationId, placeId, operation, "reservation/" + reservationId + "/" + operation);
    }
    public boolean hasPending(long placeId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from reservation_place_commands where place_id = ? and not completed)", Boolean.class, placeId));
    }
    @Scheduled(fixedDelayString = "${parking.sync.delay-ms:5000}")
    public void scheduledDispatch() { if (environment.getProperty("parking.sync.enabled", Boolean.class, false)) { dispatchBatch(); } }
    public void dispatchBatch() {
        for (int i = 0; i < 25; i++) { if (!Boolean.TRUE.equals(transaction.execute(status -> processOne()))) { return; } }
    }
    private boolean processOne() {
        List<Command> commands = jdbc.query("""
            select c.id, c.reservation_id, c.place_id, c.operation, c.operation_key, c.attempts
            from reservation_place_commands c where not c.completed and c.next_attempt <= ?
            and not exists (select 1 from reservation_place_commands p where p.reservation_id = c.reservation_id and p.id < c.id and not p.completed)
            order by c.id limit 1 for update of c skip locked
            """, (row, index) -> new Command(row.getLong(1), row.getLong(2), row.getLong(3), row.getString(4), row.getString(5), row.getInt(6)), OffsetDateTime.now(clock));
        if (commands.isEmpty()) { return false; }
        Command command = commands.getFirst();
        try {
            gateway.changeOccupancy(command.placeId(), command.reservationId(), command.operation(), command.key());
            jdbc.update("update reservation_place_commands set completed = true, attempts = attempts + 1, last_error = null where id = ?", command.id());
            jdbc.update("update reservations r set places_sync_pending = exists (select 1 from reservation_place_commands c where c.reservation_id = r.id and not c.completed), version = version + 1 where r.id = ?", command.reservationId());
        } catch (ReservationFailure failure) {
            long delay = Math.min(60, 1L << Math.min(command.attempts() + 1, 6));
            jdbc.update("update reservation_place_commands set attempts = attempts + 1, next_attempt = ?, last_error = ? where id = ?", OffsetDateTime.now(clock).plusSeconds(delay), failure.code(), command.id());
        }
        return true;
    }
    private record Command(long id, long reservationId, long placeId, String operation, String key, int attempts) { }
}
