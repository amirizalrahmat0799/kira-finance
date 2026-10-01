package com.kira.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kira.auth.AuthDtos.LoginRequest;
import com.kira.auth.AuthDtos.RefreshRequest;
import com.kira.auth.AuthDtos.RegisterRequest;
import com.kira.auth.AuthDtos.TokenResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/auth")
@Validated
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/register")
    public ResponseEntity<TokenResponse> register(@Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(auth.register(req.name(), req.email(), req.password()));
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest req) {
        return auth.login(req.email(), req.password());
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(@Valid @RequestBody RefreshRequest req) {
        return auth.refresh(req.refreshToken());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody RefreshRequest req) {
        auth.logout(req.refreshToken());
        return ResponseEntity.noContent().build();
    }
}
