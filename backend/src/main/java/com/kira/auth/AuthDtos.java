package com.kira.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request and response bodies for /api/v1/auth. */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 8, max = 128) String password) {
    }

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    public record UserView(String email, String name) {
    }

    public record TokenResponse(String accessToken, long expiresIn, String refreshToken, UserView user) {
    }
}
