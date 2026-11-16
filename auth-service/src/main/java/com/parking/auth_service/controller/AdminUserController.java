package com.parking.auth_service.controller;

import com.parking.auth_service.dto.*;
import com.parking.auth_service.model.AuthAccount;
import com.parking.auth_service.model.AuthRole;
import com.parking.auth_service.repository.JdbcAuthAccountRepository;
import com.parking.auth_service.security.ParkingUserPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.web.bind.annotation.*;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

@RestController
@ConditionalOnWebApplication
@RequestMapping("/api/auth/admin/users")
public class AdminUserController {

    private static final Logger logger = LoggerFactory.getLogger(AdminUserController.class);
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private final JdbcAuthAccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectProvider<FindByIndexNameSessionRepository<? extends Session>> sessionRepositoryProvider;

    public AdminUserController(
            JdbcAuthAccountRepository accountRepository,
            PasswordEncoder passwordEncoder,
            ObjectProvider<FindByIndexNameSessionRepository<? extends Session>> sessionRepositoryProvider
    ) {
        this.accountRepository = accountRepository;
        this.passwordEncoder = passwordEncoder;
        this.sessionRepositoryProvider = sessionRepositoryProvider;
    }

    @GetMapping
    public ResponseEntity<AdminUserPageResponse> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q
    ) {
        if (page < 0) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Le numéro de page doit être supérieur ou égal à 0");
        }
        if (size <= 0 || size > 100) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "La taille de page doit être comprise entre 1 et 100");
        }

        JdbcAuthAccountRepository.PageResult<AuthAccount> result = accountRepository.findAll(page, size, q);
        List<AdminUserSummaryResponse> content = result.content().stream()
                .map(AdminUserSummaryResponse::fromAccount)
                .toList();

        AdminUserPageResponse response = new AdminUserPageResponse(
                content,
                result.page(),
                result.size(),
                result.totalElements(),
                result.totalPages()
        );
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(response);
    }

    @PostMapping
    public ResponseEntity<AdminUserSummaryResponse> createUser(
            @AuthenticationPrincipal ParkingUserPrincipal principal,
            @RequestBody AdminCreateUserRequest request
    ) {
        if (request == null) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Corps de requête manquant");
        }

        String email = validateEmail(request.email());
        if (accountRepository.existsByEmail(email)) {
            throw new AdminException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "Cette adresse e-mail est déjà utilisée");
        }

        String displayName = validateDisplayName(request.displayName());
        validatePassword(request.password());
        Set<AuthRole> roles = parseRoles(request.roles());

        String passwordHash = passwordEncoder.encode(request.password());
        AuthAccount created = accountRepository.create(email, displayName, passwordHash, true, roles);

        String adminName = principal != null ? principal.getUsername() : "system";
        logger.info("Admin [{}] created user id=[{}] email=[{}] roles={}", adminName, created.id(), created.email(), created.roles());

        return ResponseEntity.status(HttpStatus.CREATED)
                .cacheControl(CacheControl.noStore())
                .body(AdminUserSummaryResponse.fromAccount(created));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<AdminUserSummaryResponse> updateUser(
            @AuthenticationPrincipal ParkingUserPrincipal principal,
            @PathVariable Long id,
            @RequestBody AdminUpdateUserRequest request
    ) {
        if (id == null || id <= 0) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Identifiant utilisateur invalide");
        }
        if (request == null || (request.enabled() == null && request.displayName() == null
                && request.roles() == null && request.newPassword() == null)) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Au moins un champ à modifier est requis");
        }

        AuthAccount target = accountRepository.findById(id)
                .orElseThrow(() -> new AdminException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Utilisateur introuvable"));

        String displayName = null;
        if (request.displayName() != null) {
            displayName = validateDisplayName(request.displayName());
        }

        if (request.newPassword() != null) {
            validatePassword(request.newPassword());
        }

        Set<AuthRole> parsedRoles = null;
        if (request.roles() != null) {
            parsedRoles = parseRoles(request.roles());
        }

        // Rule: An admin cannot disable themselves or remove their own ADMIN role (409)
        Long currentAdminId = principal != null ? principal.getUserId() : null;
        if (currentAdminId != null && currentAdminId.equals(target.id())) {
            if (Boolean.FALSE.equals(request.enabled())) {
                throw new AdminException(HttpStatus.CONFLICT, "CONFLICT", "Un administrateur ne peut pas désactiver son propre compte");
            }
            if (parsedRoles != null && !parsedRoles.contains(AuthRole.ADMIN)) {
                throw new AdminException(HttpStatus.CONFLICT, "CONFLICT", "Un administrateur ne peut pas retirer son propre rôle ADMIN");
            }
        }

        // Rule: The last enabled ADMIN cannot be disabled or demoted (409)
        boolean targetIsActiveAdmin = target.enabled() && target.roles().contains(AuthRole.ADMIN);
        if (targetIsActiveAdmin) {
            boolean willLoseActiveAdmin = Boolean.FALSE.equals(request.enabled())
                    || (parsedRoles != null && !parsedRoles.contains(AuthRole.ADMIN));
            if (willLoseActiveAdmin) {
                int count = accountRepository.countEnabledAdmins();
                if (count <= 1) {
                    throw new AdminException(HttpStatus.CONFLICT, "CONFLICT", "Le dernier administrateur actif ne peut pas être désactivé ou rétrogradé");
                }
            }
        }

        // Session invalidation rule: When disabled, roles change, or password is reset
        boolean disabledNow = Boolean.FALSE.equals(request.enabled()) && target.enabled();
        boolean rolesChanged = parsedRoles != null && !parsedRoles.equals(target.roles());
        boolean passwordReset = request.newPassword() != null && !request.newPassword().isBlank();

        if (disabledNow || rolesChanged || passwordReset) {
            invalidateSessions(target.email());
        }

        String passwordHash = passwordReset ? passwordEncoder.encode(request.newPassword()) : null;
        AuthAccount updated = accountRepository.update(id, displayName, passwordHash, request.enabled(), parsedRoles);

        String adminName = principal != null ? principal.getUsername() : "system";
        logger.info("Admin [{}] updated user id=[{}] email=[{}]: enabled={}, rolesChanged={}, passwordReset={}",
                adminName, id, target.email(), request.enabled(), rolesChanged, passwordReset);

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(AdminUserSummaryResponse.fromAccount(updated));
    }

    private void invalidateSessions(String email) {
        try {
            var repo = sessionRepositoryProvider.getIfAvailable();
            if (repo != null) {
                var userSessions = repo.findByPrincipalName(email);
                if (userSessions != null) {
                    for (String sessionId : userSessions.keySet()) {
                        repo.deleteById(sessionId);
                    }
                }
            }
        } catch (Exception e) {
            logger.warn("Could not delete sessions via FindByIndexNameSessionRepository for {}: {}", email, e.getMessage());
        }
        accountRepository.deleteSessionsByPrincipalName(email);
    }

    private String validateEmail(String email) {
        if (email == null || email.isBlank() || !EMAIL_PATTERN.matcher(email.trim()).matches()) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Format d'adresse e-mail invalide");
        }
        return email.trim();
    }

    private String validateDisplayName(String displayName) {
        if (displayName == null || displayName.trim().isEmpty()) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Le nom d'affichage est requis");
        }
        if (displayName.trim().length() > 100) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Le nom d'affichage ne peut pas dépasser 100 caractères");
        }
        return displayName.trim();
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < 12) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Le mot de passe doit comporter au moins 12 caractères");
        }
    }

    private Set<AuthRole> parseRoles(List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Au moins un rôle est requis");
        }
        Set<AuthRole> result = EnumSet.noneOf(AuthRole.class);
        for (String r : roles) {
            if (r == null || r.isBlank()) {
                throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Rôle vide non autorisé");
            }
            try {
                result.add(AuthRole.valueOf(r.trim().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Rôle non reconnu : " + r);
            }
        }
        return result;
    }

    @ExceptionHandler(AdminException.class)
    public ResponseEntity<AuthErrorResponse> handleAdminException(AdminException ex) {
        return ResponseEntity.status(ex.status())
                .cacheControl(CacheControl.noStore())
                .body(new AuthErrorResponse(ex.code(), ex.getMessage()));
    }
}
