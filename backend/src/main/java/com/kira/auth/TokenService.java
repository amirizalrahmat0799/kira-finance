package com.kira.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Component;

import com.kira.config.KiraProperties;

/** Mints access tokens (signed JWTs) and opaque refresh tokens (random, stored only as a SHA-256 hash). */
@Component
public class TokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final JwtEncoder encoder;
    private final String issuer;
    private final Duration accessTtl;
    private final Clock clock;

    @Autowired // the package-private constructor below is for tests
    public TokenService(JwtEncoder encoder, KiraProperties props) {
        this(encoder, props.jwt().issuer(), props.jwt().accessTokenTtl(), Clock.systemUTC());
    }

    TokenService(JwtEncoder encoder, String issuer, Duration accessTtl, Clock clock) {
        this.encoder = encoder;
        this.issuer = issuer;
        this.accessTtl = accessTtl;
        this.clock = clock;
    }

    public String accessToken(UUID userId, String email) {
        Instant now = clock.instant();
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer(issuer)
            .subject(userId.toString())
            .claim("email", email)
            .issuedAt(now)
            .expiresAt(now.plus(accessTtl))
            .id(UUID.randomUUID().toString())
            .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public long accessTokenSeconds() {
        return accessTtl.toSeconds();
    }

    /** 256 random bits, URL-safe. Only its hash is stored, so a database leak doesn't leak usable tokens. */
    public static String newRefreshToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String hash(String refreshToken) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(refreshToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
