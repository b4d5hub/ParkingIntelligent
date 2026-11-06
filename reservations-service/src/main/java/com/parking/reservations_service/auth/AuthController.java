package com.parking.reservations_service.auth;

import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Profile("auth")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @GetMapping("/csrf")
    public ResponseEntity<CsrfResponse> csrf(CsrfToken token) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new CsrfResponse(token.getHeaderName(), token.getToken()));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal ParkingUserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).cacheControl(CacheControl.noStore())
                    .body(new AuthErrorResponse("AUTHENTICATION_REQUIRED", "Authentification requise"));
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(AuthUserResponse.fromPrincipal(principal));
    }

    public record CsrfResponse(String headerName, String token) {
    }
}
