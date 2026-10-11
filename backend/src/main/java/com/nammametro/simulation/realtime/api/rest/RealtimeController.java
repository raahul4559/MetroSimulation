package com.nammametro.simulation.realtime.api.rest;

import com.nammametro.simulation.domain.exception.ResourceNotFoundException;
import com.nammametro.simulation.realtime.api.rest.dto.MetroStateResponse;
import com.nammametro.simulation.realtime.application.MetroStateManager;
import com.nammametro.simulation.realtime.domain.DataSource;
import com.nammametro.simulation.realtime.domain.MetroTime;
import com.nammametro.simulation.realtime.domain.ProviderSnapshot;
import com.nammametro.simulation.realtime.domain.RealtimeMode;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;

/**
 * The canonical metro state: {@code /api/realtime}. The same object is pushed on
 * {@code /topic/realtime/state}; {@code GET /state} is for seeding a client before its first frame.
 */
@RestController
@RequestMapping("/api/realtime")
public class RealtimeController {

    private final MetroStateManager manager;
    private final Clock clock;

    public RealtimeController(MetroStateManager manager, Clock metroClock) {
        this.manager = manager;
        this.clock = metroClock;
    }

    @GetMapping("/state")
    public MetroStateResponse state() {
        return MetroStateResponse.from(manager.current());
    }

    /** The authoritative server time, for clients that only need to sync their clock. */
    @GetMapping("/time")
    public ServerTimeResponse time() {
        Instant now = clock.instant();
        return new ServerTimeResponse(now.toString(), now.atZone(MetroTime.ZONE).toOffsetDateTime().toString(),
                now.toEpochMilli(), MetroTime.ZONE.getId());
    }

    /** {@code AUTO}, {@code LIVE}, {@code GTFS_REALTIME}, {@code SCHEDULE} or {@code SIMULATION};
     * 400 on anything else. Not persisted — a restart returns to {@code realtime.mode}. */
    @PostMapping("/mode")
    public MetroStateResponse setMode(@RequestParam String value) {
        RealtimeMode mode;
        try {
            mode = RealtimeMode.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown realtime mode '%s'".formatted(value));
        }
        return MetroStateResponse.from(manager.setMode(mode));
    }

    /** A provider's raw, un-normalized output — what it reported before mapping onto the network. */
    @GetMapping("/providers/{source}/feed")
    public ProviderSnapshot providerFeed(@PathVariable String source) {
        DataSource dataSource;
        try {
            dataSource = DataSource.valueOf(source.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown data source '%s'".formatted(source));
        }
        return manager.rawSnapshot(dataSource)
                .orElseThrow(() -> new ResourceNotFoundException("Provider feed", dataSource.name()));
    }

    public record ServerTimeResponse(String serverTime, String serverTimeIst, long serverEpochMillis, String timezone) {
    }
}
