package com.kira.user;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    private final JdbcClient jdbc;

    public UserRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<User> findByEmail(String email) {
        return jdbc.sql("SELECT * FROM users WHERE lower(email) = lower(:email)")
            .param("email", email)
            .query(UserRepository::map)
            .optional();
    }

    public Optional<User> findById(UUID id) {
        return jdbc.sql("SELECT * FROM users WHERE id = :id").param("id", id).query(UserRepository::map).optional();
    }

    public boolean emailTaken(String email) {
        return jdbc.sql("SELECT count(*) FROM users WHERE lower(email) = lower(:email)")
            .param("email", email)
            .query(Long.class)
            .single() > 0;
    }

    public void insert(User user) {
        jdbc.sql("INSERT INTO users (id, email, name, password_hash) VALUES (:id, :email, :name, :hash)")
            .param("id", user.id())
            .param("email", user.email())
            .param("name", user.name())
            .param("hash", user.passwordHash())
            .update();
    }

    /** Deletes the user and, through ON DELETE CASCADE, all their tokens and synced data. */
    public void delete(UUID id) {
        jdbc.sql("DELETE FROM users WHERE id = :id").param("id", id).update();
    }

    private static User map(ResultSet rs, int row) throws SQLException {
        Timestamp created = rs.getTimestamp("created_at");
        return new User(
            rs.getObject("id", UUID.class),
            rs.getString("email"),
            rs.getString("name"),
            rs.getString("password_hash"),
            created == null ? null : created.toInstant());
    }
}
