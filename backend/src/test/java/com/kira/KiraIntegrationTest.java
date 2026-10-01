package com.kira;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * End-to-end tests against a real PostgreSQL. CI starts one as a service container;
 * locally: {@code docker compose up -d db} and set KIRA_TEST_DB_URL=jdbc:postgresql://localhost:5432/kira.
 */
@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "KIRA_TEST_DB_URL", matches = ".+")
class KiraIntegrationTest {

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getenv("KIRA_TEST_DB_URL"));
        registry.add("spring.datasource.username", () -> envOr("KIRA_TEST_DB_USER", "kira"));
        registry.add("spring.datasource.password", () -> envOr("KIRA_TEST_DB_PASSWORD", "kira"));
    }

    private static String envOr(String name, String fallback) {
        String v = System.getenv(name);
        return v == null || v.isBlank() ? fallback : v;
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    // -------------------------------------------------------------------------------------------
    // Auth
    // -------------------------------------------------------------------------------------------

    @Test
    void registerLoginAndMe() throws Exception {
        String email = uniqueEmail();
        JsonNode reg = call(post("/api/v1/auth/register"), Map.of("name", "Mizal", "email", email, "password", "correct-horse"), 201);
        assertThat(reg.path("user").path("email").asText()).isEqualTo(email);
        assertThat(reg.path("accessToken").asText()).isNotBlank();

        call(post("/api/v1/auth/register"), Map.of("name", "Again", "email", email.toUpperCase(), "password", "correct-horse"), 409);
        call(post("/api/v1/auth/login"), Map.of("email", email, "password", "wrong-password"), 401);
        call(post("/api/v1/auth/login"), Map.of("email", "nobody-" + email, "password", "correct-horse"), 401);

        JsonNode login = call(post("/api/v1/auth/login"), Map.of("email", email.toUpperCase(), "password", "correct-horse"), 200);
        JsonNode me = call(authed(get("/api/v1/me"), login), null, 200);
        assertThat(me.path("name").asText()).isEqualTo("Mizal");
    }

    @Test
    void rejectsBadInputAndMissingTokens() throws Exception {
        JsonNode problem = call(post("/api/v1/auth/register"), Map.of("name", "x", "email", "not-an-email", "password", "short"), 400);
        assertThat(problem.path("detail").asText()).contains("email").contains("password");

        call(get("/api/v1/me"), null, 401);
        call(post("/api/v1/sync"), Map.of("cursor", 0), 401);
    }

    @Test
    void refreshTokensRotateAndReuseRevokesTheSession() throws Exception {
        JsonNode session = register();
        String first = session.path("refreshToken").asText();

        JsonNode second = call(post("/api/v1/auth/refresh"), Map.of("refreshToken", first), 200);
        String secondToken = second.path("refreshToken").asText();
        assertThat(secondToken).isNotEqualTo(first);

        // Replaying the old token looks like theft: it fails and the newer token is revoked too.
        call(post("/api/v1/auth/refresh"), Map.of("refreshToken", first), 401);
        call(post("/api/v1/auth/refresh"), Map.of("refreshToken", secondToken), 401);
    }

    @Test
    void logoutRevokesTheRefreshToken() throws Exception {
        JsonNode session = register();
        String refresh = session.path("refreshToken").asText();
        call(post("/api/v1/auth/logout"), Map.of("refreshToken", refresh), 204);
        call(post("/api/v1/auth/refresh"), Map.of("refreshToken", refresh), 401);
    }

    // -------------------------------------------------------------------------------------------
    // Sync
    // -------------------------------------------------------------------------------------------

    @Test
    void changesFromOnePhoneReachTheOther() throws Exception {
        JsonNode session = register();
        String txId = UUID.randomUUID().toString();

        // Phone A pushes a new expense
        JsonNode a1 = sync(session, 0, Map.of("transactions", List.of(tx(txId, 1250, 1_000L, false))));
        long cursorA = a1.path("cursor").asLong();
        assertThat(cursorA).isPositive();

        // Phone B, syncing for the first time, receives it
        JsonNode b1 = sync(session, 0, Map.of());
        assertThat(b1.path("changes").path("transactions")).hasSize(1);
        assertThat(b1.path("changes").path("transactions").get(0).path("amount").asLong()).isEqualTo(1250);
        assertThat(b1.path("changes").path("transactions").get(0).path("occurredOn").asText()).isEqualTo("2026-10-02");
        long cursorB = b1.path("cursor").asLong();

        // Nothing new since the cursor
        assertThat(sync(session, cursorB, Map.of()).path("changes").path("transactions")).isEmpty();

        // Phone B edits it later; phone A then sends an older edit, which loses
        sync(session, cursorB, Map.of("transactions", List.of(tx(txId, 2000, 2_000L, false))));
        JsonNode a2 = sync(session, cursorA, Map.of("transactions", List.of(tx(txId, 999, 1_500L, false))));
        JsonNode merged = a2.path("changes").path("transactions").get(0);
        assertThat(merged.path("amount").asLong()).isEqualTo(2000);

        // Deleting syncs as a tombstone
        JsonNode a3 = sync(session, a2.path("cursor").asLong(), Map.of("transactions", List.of(tx(txId, 2000, 3_000L, true))));
        assertThat(a3.path("changes").path("transactions").get(0).path("deleted").asBoolean()).isTrue();
    }

    @Test
    void usersCannotSeeOrOverwriteEachOthersData() throws Exception {
        JsonNode alice = register();
        JsonNode bob = register();
        String txId = UUID.randomUUID().toString();

        sync(alice, 0, Map.of("transactions", List.of(tx(txId, 1000, 1_000L, false))));
        JsonNode bobView = sync(bob, 0, Map.of("transactions", List.of(tx(txId, 1, 9_999L, false))));
        assertThat(bobView.path("changes").path("transactions")).isEmpty();

        JsonNode aliceView = sync(alice, 0, Map.of());
        assertThat(aliceView.path("changes").path("transactions").get(0).path("amount").asLong()).isEqualTo(1000);
    }

    @Test
    void syncsEveryTableType() throws Exception {
        JsonNode session = register();
        String category = UUID.randomUUID().toString();
        String account = UUID.randomUUID().toString();
        Map<String, Object> changes = Map.of(
            "accounts", List.of(Map.of("id", account, "name", "Maybank", "type", "bank", "openingBalance", 350000,
                "archived", false, "updatedAt", 1, "deleted", false)),
            "categories", List.of(Map.of("id", category, "name", "Food", "kind", "expense", "color", "#F97316",
                "icon", "🍜", "updatedAt", 1, "deleted", false)),
            "budgets", List.of(Map.of("id", UUID.randomUUID().toString(), "categoryId", category, "amount", 70000,
                "updatedAt", 1, "deleted", false)),
            "recurring", List.of(Map.ofEntries(
                Map.entry("id", UUID.randomUUID().toString()), Map.entry("name", "Rent"), Map.entry("accountId", account),
                Map.entry("categoryId", category), Map.entry("kind", "expense"), Map.entry("amount", 120000),
                Map.entry("frequency", "monthly"), Map.entry("startDate", "2026-01-31"), Map.entry("remindDaysBefore", 2),
                Map.entry("active", true), Map.entry("updatedAt", 1), Map.entry("deleted", false))));

        JsonNode res = sync(session, 0, changes);

        assertThat(res.path("changes").path("accounts").get(0).path("openingBalance").asLong()).isEqualTo(350000);
        assertThat(res.path("changes").path("categories").get(0).path("icon").asText()).isEqualTo("🍜");
        assertThat(res.path("changes").path("budgets")).hasSize(1);
        assertThat(res.path("changes").path("recurring").get(0).path("startDate").asText()).isEqualTo("2026-01-31");
    }

    @Test
    void rejectsInvalidRows() throws Exception {
        JsonNode session = register();
        Map<String, Object> bad = Map.of("id", UUID.randomUUID().toString(), "accountId", UUID.randomUUID().toString(),
            "categoryId", UUID.randomUUID().toString(), "kind", "refund", "amount", -5, "occurredOn", "2026-10-02",
            "updatedAt", 1, "deleted", false);
        call(authed(post("/api/v1/sync"), session), Map.of("cursor", 0, "changes", Map.of("transactions", List.of(bad))), 400);
    }

    @Test
    void deletingTheAccountRemovesItsData() throws Exception {
        JsonNode session = register();
        sync(session, 0, Map.of("transactions", List.of(tx(UUID.randomUUID().toString(), 100, 1L, false))));
        call(authed(delete("/api/v1/me"), session), null, 204);
        call(authed(get("/api/v1/me"), session), null, 401);
    }

    // -------------------------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------------------------

    private static String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }

    private JsonNode register() throws Exception {
        return call(post("/api/v1/auth/register"), Map.of("name", "Test", "email", uniqueEmail(), "password", "correct-horse"), 201);
    }

    private static Map<String, Object> tx(String id, long amount, long updatedAt, boolean deleted) {
        return Map.of("id", id, "accountId", "11111111-1111-4111-8111-111111111111",
            "categoryId", "22222222-2222-4222-8222-222222222222", "kind", "expense", "amount", amount,
            "note", "Laksa", "occurredOn", "2026-10-02", "updatedAt", updatedAt, "deleted", deleted);
    }

    private JsonNode sync(JsonNode session, long cursor, Map<String, Object> changes) throws Exception {
        return call(authed(post("/api/v1/sync"), session), Map.of("cursor", cursor, "changes", changes), 200);
    }

    private static MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder req, JsonNode session) {
        return req.header("Authorization", "Bearer " + session.path("accessToken").asText());
    }

    private JsonNode call(MockHttpServletRequestBuilder req, Object body, int expectedStatus) throws Exception {
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        MvcResult res = mvc.perform(req).andReturn();
        String text = res.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(res.getResponse().getStatus()).as("status of %s, body: %s", res.getRequest().getRequestURI(), text)
            .isEqualTo(expectedStatus);
        return text.isBlank() ? json.createObjectNode() : json.readTree(text);
    }
}
