package com.kira.auth;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class RefreshTokenRepository {

    public record StoredToken(UUID id, UUID userId, UUID familyId, Instant expiresAt, Instant revokedAt) {

        boolean revoked() {
            return revokedAt != null;
        }
    }

    private final JdbcClient jdbc;

    public RefreshTokenRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(UUID id, UUID userId, UUID familyId, String tokenHash, Instant expiresAt) {
        jdbc.sql("""
                INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at)
                VALUES (:id, :userId, :familyId, :hash, :expiresAt)""")
            .param("id", id)
            .param("userId", userId)
            .param("familyId", familyId)
            .param("hash", tokenHash)
            .param("expiresAt", Timestamp.from(expiresAt))
            .update();
    }

    /** Locks the row so two concurrent refreshes with the same token can't both succeed. */
    public Optional<StoredToken> findByHashForUpdate(String tokenHash) {
        return jdbc.sql("SELECT * FROM refresh_tokens WHERE token_hash = :hash FOR UPDATE")
            .param("hash", tokenHash)
            .query(RefreshTokenRepository::map)
            .optional();
    }

    public void markRotated(UUID id, UUID replacedBy) {
        jdbc.sql("UPDATE refresh_tokens SET revoked_at = now(), replaced_by = :next WHERE id = :id")
            .param("id", id)
            .param("next", replacedBy)
            .update();
    }

    public int revokeFamily(UUID familyId) {
        return jdbc.sql("UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = :family AND revoked_at IS NULL")
            .param("family", familyId)
            .update();
    }

    public int deleteExpired() {
        return jdbc.sql("DELETE FROM refresh_tokens WHERE expires_at < now() - interval '7 days'").update();
    }

    private static StoredToken map(ResultSet rs, int row) throws SQLException {
        Timestamp revoked = rs.getTimestamp("revoked_at");
        return new StoredToken(
            rs.getObject("id", UUID.class),
            rs.getObject("user_id", UUID.class),
            rs.getObject("family_id", UUID.class),
            rs.getTimestamp("expires_at").toInstant(),
            revoked == null ? null : revoked.toInstant());
    }
}
