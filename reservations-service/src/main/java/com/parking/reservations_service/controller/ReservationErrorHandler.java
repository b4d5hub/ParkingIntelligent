package com.parking.reservations_service.controller;
import com.parking.reservations_service.auth.AuthErrorResponse;
import com.parking.reservations_service.service.ReservationFailure;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.dao.DataAccessException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.MissingRequestHeaderException;

@RestControllerAdvice(basePackageClasses = ReservationController.class)
public class ReservationErrorHandler {
    @ExceptionHandler(ReservationFailure.class)
    ResponseEntity<AuthErrorResponse> failure(ReservationFailure exception) {
        return ResponseEntity.status(exception.status()).body(new AuthErrorResponse(exception.code(), exception.getMessage()));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class, HandlerMethodValidationException.class,
        MethodArgumentTypeMismatchException.class, HttpMessageNotReadableException.class,
        MissingServletRequestParameterException.class, MissingRequestHeaderException.class})
    ResponseEntity<AuthErrorResponse> invalid(Exception exception) {
        return ResponseEntity.badRequest().body(new AuthErrorResponse("INVALID_REQUEST", "Paramètres absents, inconnus ou invalides"));
    }
    @ExceptionHandler({DataIntegrityViolationException.class, ConcurrencyFailureException.class})
    ResponseEntity<AuthErrorResponse> conflict(Exception exception) {
        return ResponseEntity.status(409).body(new AuthErrorResponse("RESERVATION_CONFLICT", "Conflit concurrent : actualisez puis réessayez"));
    }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<AuthErrorResponse> storage(Exception exception) {
        return ResponseEntity.status(503).body(new AuthErrorResponse("STORAGE_UNAVAILABLE", "Stockage temporairement indisponible"));
    }
}
