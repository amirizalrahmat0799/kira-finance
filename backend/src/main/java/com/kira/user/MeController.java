package com.kira.user;

import java.time.Instant;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kira.web.ApiException;

@RestController
@RequestMapping("/api/v1/me")
public class MeController {

    public record Me(UUID id, String email, String name, Instant createdAt) {
    }

    private final UserRepository users;

    public MeController(UserRepository users) {
        this.users = users;
    }

    @GetMapping
    public Me me(@AuthenticationPrincipal Jwt jwt) {
        User u = users.findById(UUID.fromString(jwt.getSubject()))
            .orElseThrow(() -> ApiException.unauthorized("Account not found"));
        return new Me(u.id(), u.email(), u.name(), u.createdAt());
    }

    /** Deletes the account and everything synced to it. Data on the user's phones is left alone. */
    @DeleteMapping
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt) {
        users.delete(UUID.fromString(jwt.getSubject()));
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
