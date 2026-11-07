package com.parking.reservations_service.auth;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.io.Console;
import java.util.*;

/** Local operator command only; passwords never appear in arguments or logs. */
@Component
@Profile("provision & !auth")
public class ProvisionAccount implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final TransactionTemplate transaction;
    private final ConfigurableApplicationContext context;
    public ProvisionAccount(JdbcTemplate jdbc, PasswordEncoder encoder, PlatformTransactionManager manager, ConfigurableApplicationContext context) {
        this.jdbc = jdbc; this.encoder = encoder; this.transaction = new TransactionTemplate(manager); this.context = context;
    }
    @Override public void run(ApplicationArguments arguments) {
        try {
            Console console = System.console();
            if (console == null) { throw new IllegalStateException("Lancer le JAR dans un terminal interactif pour masquer le mot de passe."); }
            String email = console.readLine("Email : ").strip().toLowerCase(Locale.ROOT);
            String name = console.readLine("Nom affiché : ").strip();
            Set<AuthRole> roles = EnumSet.noneOf(AuthRole.class);
            for (String role : console.readLine("Rôles (CONDUCTEUR,AGENT,ADMIN), séparés par virgule : ").split(",")) {
                roles.add(AuthRole.valueOf(role.strip()));
            }
            if (!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+") || email.length() > 254 || name.isBlank() || name.length() > 100 || roles.isEmpty()) {
                throw new IllegalArgumentException("Informations de compte invalides.");
            }
            char[] password = console.readPassword("Phrase de passe (15 à 128 caractères) : ");
            char[] confirmation = console.readPassword("Confirmer : ");
            String hash;
            try {
                if (password.length < 15 || password.length > 128 || !Arrays.equals(password, confirmation)
                        || new String(password).strip().length() < 15) {
                    throw new IllegalArgumentException("Longueur invalide ou confirmation différente.");
                }
                hash = encoder.encode(new String(password));
            } finally { Arrays.fill(password, '\0'); Arrays.fill(confirmation, '\0'); }
            transaction.executeWithoutResult(status -> {
                Long id = jdbc.queryForObject("insert into parking_auth_users(email,display_name,password_hash,enabled) values (?,?,?,true) returning id", Long.class, email, name, hash);
                for (AuthRole role : roles) { jdbc.update("insert into parking_auth_user_roles(user_id,role) values (?,?)", id, role.name()); }
            });
            console.printf("Compte créé. Aucun mot de passe n'a été affiché.%n");
        } finally { context.close(); }
    }
}
