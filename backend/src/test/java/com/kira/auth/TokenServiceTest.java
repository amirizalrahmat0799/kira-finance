package com.kira.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import com.nimbusds.jose.jwk.source.ImmutableSecret;

class TokenServiceTest {

    private final SecretKey key = new SecretKeySpec("test-secret-test-secret-test-secret-123".getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    private final NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();

    @Test
    void accessTokenCarriesTheUserAndExpires() {
        TokenService tokens = new TokenService(new NimbusJwtEncoder(new ImmutableSecret<>(key)), "kira-api", Duration.ofMinutes(15), Clock.systemUTC());
        UUID user = UUID.randomUUID();

        Jwt jwt = decoder.decode(tokens.accessToken(user, "mizal@example.com"));

        assertThat(jwt.getSubject()).isEqualTo(user.toString());
        assertThat(jwt.getClaimAsString("iss")).isEqualTo("kira-api");
        assertThat(jwt.getClaimAsString("email")).isEqualTo("mizal@example.com");
        assertThat(Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt())).isEqualTo(Duration.ofMinutes(15));
        assertThat(tokens.accessTokenSeconds()).isEqualTo(900);
    }

    @Test
    void expiredTokensAreRejected() {
        Clock past = Clock.fixed(Instant.now().minus(Duration.ofHours(2)), ZoneOffset.UTC);
        TokenService tokens = new TokenService(new NimbusJwtEncoder(new ImmutableSecret<>(key)), "kira-api", Duration.ofMinutes(15), past);

        String token = tokens.accessToken(UUID.randomUUID(), "a@b.co");

        assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void refreshTokensAreRandomAndStoredAsAStableHash() {
        String a = TokenService.newRefreshToken();
        String b = TokenService.newRefreshToken();

        assertThat(a).hasSize(43).isNotEqualTo(b); // 32 bytes, base64url without padding
        assertThat(TokenService.hash(a)).hasSize(64).isEqualTo(TokenService.hash(a)).isNotEqualTo(TokenService.hash(b));
    }
}
