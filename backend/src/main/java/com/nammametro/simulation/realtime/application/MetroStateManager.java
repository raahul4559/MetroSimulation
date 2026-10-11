package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.domain.model.SimulationStatus;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.domain.DataSource;
import com.nammametro.simulation.realtime.domain.LineOperatingStatus;
import com.nammametro.simulation.realtime.domain.LineOperatingStatus.OperatingState;
import com.nammametro.simulation.realtime.domain.MetroAlert;
import com.nammametro.simulation.realtime.domain.MetroState;
import com.nammametro.simulation.realtime.domain.MetroTime;
import com.nammametro.simulation.realtime.domain.MetroTrain;
import com.nammametro.simulation.realtime.domain.ProviderHealth;
import com.nammametro.simulation.realtime.domain.ProviderHealth.ProviderStatus;
import com.nammametro.simulation.realtime.domain.ProviderSnapshot;
import com.nammametro.simulation.realtime.domain.RealtimeMode;
import com.nammametro.simulation.trainsim.application.TrainSimulationControlUseCase;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * The canonical metro state manager — the single place a {@link MetroState} is built, and so the
 * single source of truth for every frontend view.
 *
 * <pre>
 * provider (remote: polled with backoff | local: evaluated per publish)
 *   -> FeedNormalizer (validate, map onto the network, reject what can't be placed)
 *   -> this manager (pick the active source, extrapolate, stamp freshness, assign stable ids)
 *   -> MetroStatePublisher (/topic/realtime/state) + GET /api/realtime/state
 * </pre>
 *
 * <p><b>Threads.</b> Remote providers are fetched on this manager's own small pool, never on
 * Spring's scheduling thread — that thread also runs the simulation's tick, and a 10-second HTTP
 * timeout must never stall it. Publishing happens either on the simulation's tick (via
 * {@link SimulationStatePublishedEvent}, while the simulation is the active, running source — so
 * every simulated tick reaches clients exactly once) or on {@link #heartbeat()} otherwise.
 * {@link #publishNow()} is synchronized so versions go out in order.
 *
 * <p><b>Time.</b> Every "now" comes from the injected {@link Clock} — the server's clock is
 * authoritative, and tests pin it.
 *
 * <p><b>Honesty.</b> A pinned mode never falls back. {@link RealtimeMode#AUTO} falls back down the
 * chain {@code LIVE -> GTFS_REALTIME -> SCHEDULE -> SIMULATION}, and {@code sourceReason} always
 * says why the active source is the one shown.
 */
public class MetroStateManager {

    private static final Logger log = LoggerFactory.getLogger(MetroStateManager.class);
    private static final long FIRST_FEED_TRAIN_ID = 1_000_000L;
    private static final int LOG_EVERY_NTH_FAILURE = 10;
    private static final List<DataSource> AUTO_ORDER =
            List.of(DataSource.LIVE, DataSource.GTFS_REALTIME, DataSource.SCHEDULE, DataSource.SIMULATION);

    private final Clock clock;
    private final MetroNetwork network;
    private final ServiceCalendar calendar;
    private final FeedNormalizer normalizer;
    private final RealtimeSettings settings;
    private final TrainSimulationControlUseCase simulation;
    private final MetroStatePublisher publisher;
    private final Duration maxBackoff;
    private final Map<DataSource, ProviderRuntime> runtimes = new EnumMap<>(DataSource.class);

    private final String instanceId = UUID.randomUUID().toString();
    private final AtomicReference<RealtimeMode> mode;
    private final AtomicReference<MetroState> latest = new AtomicReference<>();
    private final Map<String, IdEntry> idsByKey = new HashMap<>();
    private long nextFeedTrainId = FIRST_FEED_TRAIN_ID;
    private long version;
    private volatile Instant lastPublishedAt = Instant.EPOCH;

    private ScheduledExecutorService pollers;

    public MetroStateManager(Clock clock, MetroNetwork network, ServiceCalendar calendar, RealtimeSettings settings,
                             List<MetroRealtimeProvider> providers, TrainSimulationControlUseCase simulation,
                             MetroStatePublisher publisher, RealtimeMode initialMode, Duration maxBackoff) {
        this.clock = clock;
        this.network = network;
        this.calendar = calendar;
        this.settings = settings;
        this.normalizer = new FeedNormalizer(network, settings);
        this.simulation = simulation;
        this.publisher = publisher;
        this.mode = new AtomicReference<>(initialMode);
        this.maxBackoff = maxBackoff;
        for (MetroRealtimeProvider provider : providers) {
            if (runtimes.put(provider.source(), new ProviderRuntime(provider)) != null) {
                throw new IllegalStateException("More than one realtime provider registered for " + provider.source());
            }
        }
    }

    // --- lifecycle --------------------------------------------------------------------------------

    /** Starts polling every configured remote provider. Unconfigured ones are logged once and never
     * contacted. */
    public void start() {
        pollers = Executors.newScheduledThreadPool(2, runnable -> {
            Thread thread = new Thread(runnable, "realtime-poller");
            thread.setDaemon(true);
            return thread;
        });
        for (ProviderRuntime runtime : runtimes.values()) {
            MetroRealtimeProvider provider = runtime.provider;
            if (!provider.isPolled()) {
                continue;
            }
            if (!provider.isConfigured()) {
                log.info("Realtime provider '{}' ({}) is not configured; it will not be polled", provider.name(),
                        provider.source());
                continue;
            }
            log.info("Polling realtime provider '{}' ({}) every {}s", provider.name(), provider.source(),
                    provider.pollInterval().toSeconds());
            pollers.schedule(() -> pollLoop(runtime), 0, TimeUnit.MILLISECONDS);
        }
        log.info("Metro state manager started in {} mode (timetable {})", mode.get(),
                calendar.timetable().isConfigured() ? "configured" : "not configured");
    }

    public void stop() {
        if (pollers != null) {
            pollers.shutdownNow();
        }
    }

    // --- public API -------------------------------------------------------------------------------

    public MetroState current() {
        MetroState state = latest.get();
        return state != null ? state : publishNow();
    }

    public RealtimeMode mode() {
        return mode.get();
    }

    public MetroState setMode(RealtimeMode newMode) {
        RealtimeMode previous = mode.getAndSet(newMode);
        if (previous != newMode) {
            log.info("Realtime mode changed {} -> {}", previous, newMode);
        }
        return publishNow();
    }

    /** The provider's raw, un-normalized output — for diagnosing mapping problems. Remote providers
     * return their last fetched snapshot; local ones are evaluated now. */
    public Optional<ProviderSnapshot> rawSnapshot(DataSource source) {
        ProviderRuntime runtime = runtimes.get(source);
        if (runtime == null || !runtime.provider.isConfigured()) {
            return Optional.empty();
        }
        if (runtime.provider.isPolled()) {
            synchronized (runtime) {
                return Optional.ofNullable(runtime.lastSnapshot);
            }
        }
        try {
            return Optional.of(runtime.provider.fetchSnapshot(clock.instant()));
        } catch (ProviderException e) {
            return Optional.empty();
        }
    }

    // --- publishing -------------------------------------------------------------------------------

    @Scheduled(fixedRateString = "${realtime.publish-interval-ms:1000}")
    public void heartbeat() {
        MetroState previous = latest.get();
        boolean simulationDriving = previous != null && previous.activeSource() == DataSource.SIMULATION
                && simulation.getClock().status() == SimulationStatus.RUNNING
                && Duration.between(lastPublishedAt, clock.instant()).toMillis() < 2_500;
        if (!simulationDriving) {
            publishNow();
        }
    }

    @EventListener
    public void onSimulationState(SimulationStatePublishedEvent event) {
        MetroState previous = latest.get();
        if (previous == null || previous.activeSource() == DataSource.SIMULATION) {
            publishNow();
        }
    }

    /** Builds and broadcasts a fresh state. Never throws — a failure here must not take down the
     * simulation tick or the scheduler thread it was called from. */
    public synchronized MetroState publishNow() {
        try {
            MetroState state = compose(clock.instant());
            latest.set(state);
            lastPublishedAt = state.serverTime();
            publisher.publish(state);
            return state;
        } catch (RuntimeException e) {
            log.error("Failed to build or publish the metro state", e);
            MetroState fallback = latest.get();
            if (fallback == null) {
                throw e;
            }
            return fallback;
        }
    }

    MetroState compose(Instant now) {
        Map<DataSource, ProviderHealth> health = new EnumMap<>(DataSource.class);
        Map<DataSource, FeedNormalizer.Result> localResults = new EnumMap<>(DataSource.class);
        for (ProviderRuntime runtime : runtimes.values()) {
            if (!runtime.provider.isPolled() && runtime.provider.source() != DataSource.SIMULATION
                    && runtime.provider.isConfigured()) {
                evaluateLocal(runtime, now).ifPresent(r -> localResults.put(runtime.provider.source(), r));
            }
            health.put(runtime.provider.source(), healthOf(runtime, now));
        }

        RealtimeMode requested = mode.get();
        Selection selection = select(requested, health);
        DataSource active = selection.source();

        List<MetroTrain> trains;
        List<MetroAlert> alerts;
        SimulationState simulationState = null;
        if (active == DataSource.SIMULATION) {
            simulationState = simulation.getState();
            trains = simulationState.trains().stream().map(t -> MetroTrain.fromSimulation(t, now)).toList();
            alerts = List.of();
        } else if (localResults.containsKey(active)) {
            FeedNormalizer.Result result = localResults.get(active);
            trains = assignIds(result.trains(), now);
            alerts = result.alerts();
        } else {
            ProviderRuntime runtime = runtimes.get(active);
            List<MetroTrain> observed;
            List<MetroAlert> observedAlerts;
            if (runtime == null) {
                observed = List.of();
                observedAlerts = List.of();
            } else {
                synchronized (runtime) {
                    observed = runtime.trains;
                    observedAlerts = runtime.alerts;
                }
            }
            trains = assignIds(observed.stream()
                    .filter(t -> Duration.between(t.observedAt(), now).compareTo(settings.expireAfter()) <= 0)
                    .map(t -> TrainExtrapolator.at(t, now, network, settings))
                    .toList(), now);
            alerts = observedAlerts.stream().filter(a -> isActive(a, now)).toList();
        }

        ProviderHealth activeHealth = health.get(active);
        boolean activeStale = active.isObserved()
                && (activeHealth == null || activeHealth.status() != ProviderStatus.HEALTHY
                || trains.stream().anyMatch(MetroTrain::stale));

        LocalDate serviceDay = calendar.serviceDay(now);
        version++;
        return new MetroState(instanceId, version, now, MetroTime.ZONE.getId(), serviceDay,
                calendar.dayType(serviceDay).name(), requested, active, activeStale, selection.reason(),
                orderedHealth(health), lineStatuses(now, trains, alerts), trains, alerts, simulationState);
    }

    // --- source selection -------------------------------------------------------------------------

    private record Selection(DataSource source, String reason) {
    }

    private Selection select(RealtimeMode requested, Map<DataSource, ProviderHealth> health) {
        DataSource pinned = requested.pinnedSource();
        if (pinned != null) {
            ProviderHealth h = health.get(pinned);
            String reason = "Pinned to " + label(pinned);
            if (h == null) {
                reason += " — no provider registered for this source";
            } else if (h.status() != ProviderStatus.HEALTHY) {
                reason += " — " + h.status().name().toLowerCase() + (h.detail() == null ? "" : ": " + h.detail());
            }
            return new Selection(pinned, reason);
        }

        List<String> skipped = new ArrayList<>();
        for (DataSource candidate : AUTO_ORDER) {
            ProviderHealth h = health.get(candidate);
            if (h != null && h.isUsable()) {
                String reason = "Auto: using " + label(candidate);
                if (!skipped.isEmpty()) {
                    reason += " (" + String.join("; ", skipped) + ")";
                }
                return new Selection(candidate, reason);
            }
            skipped.add(label(candidate) + " " + (h == null ? "not registered" : h.status().name().toLowerCase()));
        }
        return new Selection(DataSource.SIMULATION, "Auto: no source available (" + String.join("; ", skipped) + ")");
    }

    private static String label(DataSource source) {
        return switch (source) {
            case LIVE -> "official live feed";
            case GTFS_REALTIME -> "GTFS-Realtime feed";
            case SCHEDULE -> "timetable estimate";
            case SIMULATION -> "simulation";
        };
    }

    // --- provider health --------------------------------------------------------------------------

    private ProviderHealth healthOf(ProviderRuntime runtime, Instant now) {
        MetroRealtimeProvider provider = runtime.provider;
        if (provider.source() == DataSource.SIMULATION) {
            var simClock = simulation.getClock();
            return ProviderHealth.of(DataSource.SIMULATION, provider.name(), ProviderStatus.HEALTHY,
                    "Simulation %s at %sx".formatted(simClock.status().name().toLowerCase(), simClock.speed().multiplier()));
        }
        if (!provider.isConfigured()) {
            return ProviderHealth.of(provider.source(), provider.name(), ProviderStatus.UNCONFIGURED,
                    provider.isPolled() ? "No feed URL configured" : "No timetable configured");
        }

        synchronized (runtime) {
            ProviderStatus status;
            String detail;
            if (runtime.lastSuccessAt == null) {
                status = runtime.consecutiveFailures > 0 ? ProviderStatus.ERROR : ProviderStatus.CONNECTING;
                detail = runtime.consecutiveFailures > 0 ? runtime.lastError : "Waiting for first fetch";
            } else {
                Instant dataAsOf = runtime.feedTimestamp != null && runtime.feedTimestamp.isBefore(runtime.lastSuccessAt)
                        ? runtime.feedTimestamp : runtime.lastSuccessAt;
                Duration age = Duration.between(dataAsOf, now);
                if (age.compareTo(settings.expireAfter()) > 0) {
                    status = ProviderStatus.ERROR;
                    detail = "No fresh data for %ds".formatted(age.toSeconds())
                            + (runtime.lastError != null ? "; last error: " + runtime.lastError : "");
                } else if (age.compareTo(settings.staleAfter()) > 0) {
                    status = ProviderStatus.STALE;
                    detail = "Data is %ds old".formatted(age.toSeconds())
                            + (runtime.lastError != null ? "; last error: " + runtime.lastError : "");
                } else {
                    status = ProviderStatus.HEALTHY;
                    detail = runtime.lastError != null ? "Recovered; last error: " + runtime.lastError : null;
                }
            }
            return new ProviderHealth(provider.source(), provider.name(), status, detail, runtime.lastAttemptAt,
                    runtime.lastSuccessAt, runtime.feedTimestamp, runtime.nextAttemptAt, runtime.consecutiveFailures,
                    runtime.acceptedVehicles, runtime.rejectedVehicles, runtime.rejectionReasons, runtime.warnings);
        }
    }

    private List<ProviderHealth> orderedHealth(Map<DataSource, ProviderHealth> health) {
        return AUTO_ORDER.stream().map(health::get).filter(h -> h != null).toList();
    }

    // --- remote polling ---------------------------------------------------------------------------

    private void pollLoop(ProviderRuntime runtime) {
        Duration delay;
        try {
            delay = pollOnce(runtime.provider.source());
        } catch (RuntimeException e) {
            // pollOnce handles provider failures itself; this is a bug guard so one unexpected
            // exception can't silently end polling forever.
            log.error("Unexpected failure polling '{}'", runtime.provider.name(), e);
            delay = maxBackoff;
        }
        if (pollers != null && !pollers.isShutdown()) {
            pollers.schedule(() -> pollLoop(runtime), delay.toMillis(), TimeUnit.MILLISECONDS);
        }
    }

    /** One fetch + normalize of a remote provider. Returns the delay before the next attempt:
     * the provider's interval on success, exponential backoff (with jitter) on failure. */
    Duration pollOnce(DataSource source) {
        ProviderRuntime runtime = runtimes.get(source);
        MetroRealtimeProvider provider = runtime.provider;
        Instant startedAt = clock.instant();
        synchronized (runtime) {
            runtime.lastAttemptAt = startedAt;
        }
        try {
            ProviderSnapshot snapshot = provider.fetchSnapshot(startedAt);
            Instant fetchedAt = clock.instant();
            FeedNormalizer.Result result = normalizer.normalize(provider.source(), provider.mapping(), snapshot, fetchedAt);
            int previousFailures;
            synchronized (runtime) {
                previousFailures = runtime.consecutiveFailures;
                runtime.recordSuccess(snapshot, result, fetchedAt);
                runtime.nextAttemptAt = fetchedAt.plus(provider.pollInterval());
            }
            if (previousFailures > 0) {
                log.info("Realtime provider '{}' recovered after {} failed attempt(s)", provider.name(), previousFailures);
            }
            if (result.rejectedCount() > 0) {
                log.debug("Realtime provider '{}': accepted {} vehicle(s), rejected {} {}", provider.name(),
                        result.trains().size(), result.rejectedCount(), result.rejections());
            }
            for (String warning : result.warnings()) {
                log.debug("Realtime provider '{}': {}", provider.name(), warning);
            }
            return provider.pollInterval();
        } catch (ProviderException | RuntimeException e) {
            String message = e instanceof ProviderException ? e.getMessage() : e.getClass().getSimpleName() + ": " + e.getMessage();
            int failures;
            Duration delay;
            synchronized (runtime) {
                runtime.consecutiveFailures++;
                runtime.lastError = message;
                failures = runtime.consecutiveFailures;
                delay = backoff(provider.pollInterval(), failures);
                runtime.nextAttemptAt = clock.instant().plus(delay);
            }
            if (failures == 1 || failures % LOG_EVERY_NTH_FAILURE == 0) {
                log.warn("Realtime provider '{}' failed (attempt {}): {} — retrying in {}s", provider.name(), failures,
                        message, delay.toSeconds());
            } else {
                log.debug("Realtime provider '{}' failed (attempt {}): {}", provider.name(), failures, message);
            }
            return delay;
        }
    }

    private Duration backoff(Duration base, int failures) {
        long multiplier = 1L << Math.min(failures - 1, 10);
        long millis = Math.min(maxBackoff.toMillis(), base.toMillis() * multiplier);
        double jitter = 0.8 + ThreadLocalRandom.current().nextDouble() * 0.4;
        return Duration.ofMillis(Math.max(1_000, (long) (millis * jitter)));
    }

    private Optional<FeedNormalizer.Result> evaluateLocal(ProviderRuntime runtime, Instant now) {
        MetroRealtimeProvider provider = runtime.provider;
        try {
            ProviderSnapshot snapshot = provider.fetchSnapshot(now);
            FeedNormalizer.Result result = normalizer.normalize(provider.source(), provider.mapping(), snapshot, now);
            synchronized (runtime) {
                runtime.recordSuccess(snapshot, result, now);
            }
            return Optional.of(result);
        } catch (ProviderException | RuntimeException e) {
            synchronized (runtime) {
                runtime.consecutiveFailures++;
                runtime.lastError = e.getMessage();
                runtime.lastAttemptAt = now;
            }
            log.warn("Local provider '{}' failed: {}", provider.name(), e.getMessage());
            return Optional.empty();
        }
    }

    // --- assembly helpers -------------------------------------------------------------------------

    /** Stable numeric ids for feed/timetable trains (the frontend selects trains by id): the same
     * vehicle keeps its id while it keeps appearing; ids not seen for {@code expireAfter} are freed. */
    private List<MetroTrain> assignIds(List<MetroTrain> trains, Instant now) {
        List<MetroTrain> withIds = new ArrayList<>(trains.size());
        for (MetroTrain train : trains) {
            IdEntry entry = idsByKey.computeIfAbsent(train.identityKey(), k -> new IdEntry(nextFeedTrainId++));
            entry.lastSeen = now;
            withIds.add(train.withId(entry.id));
        }
        Iterator<IdEntry> it = idsByKey.values().iterator();
        while (it.hasNext()) {
            if (Duration.between(it.next().lastSeen, now).compareTo(settings.expireAfter()) > 0) {
                it.remove();
            }
        }
        return withIds;
    }

    private List<LineOperatingStatus> lineStatuses(Instant now, List<MetroTrain> trains, List<MetroAlert> alerts) {
        Map<String, Long> counts = new HashMap<>();
        for (MetroTrain train : trains) {
            counts.merge(train.lineCode(), 1L, Long::sum);
        }
        return calendar.statuses(now).stream().map(status -> {
            int reported = counts.getOrDefault(status.lineCode(), 0L).intValue();
            Optional<MetroAlert> suspension = alerts.stream()
                    .filter(MetroAlert::suspendsService)
                    .filter(a -> a.lineCodes().contains(status.lineCode()) && a.stationIds().isEmpty())
                    .findFirst();
            if (suspension.isPresent()) {
                String reason = suspension.get().headerText() != null ? suspension.get().headerText() : "Service suspended";
                return new LineOperatingStatus(status.lineCode(), OperatingState.SUSPENDED, "ALERT", reason,
                        status.firstDeparture(), status.lastDeparture(), reported);
            }
            return new LineOperatingStatus(status.lineCode(), status.state(), status.basis(), status.reason(),
                    status.firstDeparture(), status.lastDeparture(), reported);
        }).toList();
    }

    private static boolean isActive(MetroAlert alert, Instant now) {
        return (alert.activeFrom() == null || !now.isBefore(alert.activeFrom()))
                && (alert.activeUntil() == null || now.isBefore(alert.activeUntil()));
    }

    // --- per-provider mutable state (guarded by the runtime's own monitor) ------------------------

    private static final class IdEntry {
        final long id;
        Instant lastSeen;

        IdEntry(long id) {
            this.id = id;
        }
    }

    private static final class ProviderRuntime {
        final MetroRealtimeProvider provider;
        ProviderSnapshot lastSnapshot;
        List<MetroTrain> trains = List.of();
        List<MetroAlert> alerts = List.of();
        Instant lastAttemptAt;
        Instant lastSuccessAt;
        Instant feedTimestamp;
        Instant nextAttemptAt;
        int consecutiveFailures;
        String lastError;
        int acceptedVehicles;
        int rejectedVehicles;
        Map<String, Integer> rejectionReasons = Map.of();
        List<String> warnings = List.of();

        ProviderRuntime(MetroRealtimeProvider provider) {
            this.provider = provider;
        }

        void recordSuccess(ProviderSnapshot snapshot, FeedNormalizer.Result result, Instant at) {
            lastSnapshot = snapshot;
            trains = result.trains();
            alerts = result.alerts();
            lastAttemptAt = at;
            lastSuccessAt = at;
            feedTimestamp = snapshot.feedTimestamp();
            consecutiveFailures = 0;
            acceptedVehicles = result.trains().size();
            rejectedVehicles = result.rejectedCount();
            rejectionReasons = result.rejections();
            warnings = result.warnings();
            lastError = null;
        }
    }
}
