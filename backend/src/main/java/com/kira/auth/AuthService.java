package com.kira.auth;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kira.auth.AuthDtos.TokenResponse;
import com.kira.auth.AuthDtos.UserView;
import com.kira.auth.RefreshTokenRepository.StoredToken;
import com.kira.config.KiraProperties;
import com.kira.user.User;
import com.kira.user.UserRepository;
import com.kira.web.ApiException;

@Service
public class AuthService {

    private record Issued(TokenResponse response, UUID refreshTokenId) {
    }

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final TokenService tokens;
    private final PasswordEncoder passwords;
    private final KiraProperties props;
    private final Clock clock;
    /** Compared against when the email doesn't exist, so a missing account takes as long as a wrong password. */
    private final String dummyHash;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens, TokenService tokens,
            PasswordEncoder passwords, KiraProperties props) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.tokens = tokens;
        this.passwords = passwords;
        this.props = props;
        this.clock = Clock.systemUTC();
        this.dummyHash = passwords.encode(UUID.randomUUID().toString());
    }

    @Transactional
    public TokenResponse register(String name, String email, String password) {
        String normalised = email.trim().toLowerCase(Locale.ROOT);
        if (users.emailTaken(normalised)) {
            throw ApiException.conflict("An account with this email already exists. Sign in instead.");
        }
        User user = new User(UUID.randomUUID(), normalised, name.trim(), passwords.encode(password), null);
        users.insert(user);
        return issue(user, UUID.randomUUID()).response();
    }

    @Transactional
    public TokenResponse login(String email, String password) {
        User user = users.findByEmail(email.trim()).orElse(null);
        boolean ok = passwords.matches(password, user == null ? dummyHash : user.passwordHash());
        if (user == null || !ok) {
            throw ApiException.unauthorized("Email or password is incorrect");
        }
        return issue(user, UUID.randomUUID()).response();
    }

    /**
     * Refresh-token rotation: every refresh token works once. Presenting one that was already rotated means
     * someone else has a copy, so the whole family (every token from that sign-in) is revoked.
     */
    @Transactional(noRollbackFor = ApiException.class)
    public TokenResponse refresh(String refreshToken) {
        StoredToken stored = refreshTokens.findByHashForUpdate(TokenService.hash(refreshToken))
            .orElseThrow(() -> ApiException.unauthorized("Session expired. Please sign in again."));
        if (stored.revoked()) {
            refreshTokens.revokeFamily(stored.familyId());
            throw ApiException.unauthorized("Session expired. Please sign in again.");
        }
        if (stored.expiresAt().isBefore(clock.instant())) {
            throw ApiException.unauthorized("Session expired. Please sign in again.");
        }
        User user = users.findById(stored.userId())
            .orElseThrow(() -> ApiException.unauthorized("Account not found"));

        Issued next = issue(user, stored.familyId());
        refreshTokens.markRotated(stored.id(), next.refreshTokenId());
        return next.response();
    }

    @Transactional
    public void logout(String refreshToken) {
        refreshTokens.findByHashForUpdate(TokenService.hash(refreshToken))
            .ifPresent(t -> refreshTokens.revokeFamily(t.familyId()));
    }

    @Scheduled(cron = "0 17 3 * * *")
    public void purgeExpiredTokens() {
        refreshTokens.deleteExpired();
    }

    private Issued issue(User user, UUID familyId) {
        String refresh = TokenService.newRefreshToken();
        UUID id = UUID.randomUUID();
        Instant expires = clock.instant().plus(props.jwt().refreshTokenTtl());
        refreshTokens.insert(id, user.id(), familyId, TokenService.hash(refresh), expires);
        TokenResponse response = new TokenResponse(tokens.accessToken(user.id(), user.email()), tokens.accessTokenSeconds(),
            refresh, new UserView(user.email(), user.name()));
        return new Issued(response, id);
    }
}
