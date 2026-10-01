package com.kira.sync;

import java.util.UUID;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kira.sync.SyncRows.SyncRequest;
import com.kira.sync.SyncRows.SyncResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/sync")
public class SyncController {

    private final SyncService sync;

    public SyncController(SyncService sync) {
        this.sync = sync;
    }

    /**
     * Uploads the device's unsent changes and returns every change made after {@code cursor}
     * (including other devices' edits), plus the new cursor to send next time.
     */
    @PostMapping
    public SyncResponse sync(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SyncRequest request) {
        return sync.sync(UUID.fromString(jwt.getSubject()), request);
    }
}
