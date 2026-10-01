package com.kira.config;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("kira")
public record KiraProperties(Jwt jwt, Cors cors, Sync sync) {

    public record Jwt(String secret, String issuer, Duration accessTokenTtl, Duration refreshTokenTtl) {

        public Jwt {
            if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
                throw new IllegalStateException("kira.jwt.secret must be at least 32 bytes (set KIRA_JWT_SECRET)");
            }
        }

        public byte[] secretBytes() {
            return secret.getBytes(StandardCharsets.UTF_8);
        }
    }

    public record Cors(List<String> allowedOrigins) {
    }

    public record Sync(int maxRowsPerTable) {
    }
}
