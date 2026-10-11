package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.realtime.domain.DataSource;
import com.nammametro.simulation.realtime.domain.ProviderSnapshot;
import com.nammametro.simulation.realtime.domain.ServiceAlert;
import com.nammametro.simulation.realtime.domain.TripUpdate;
import com.nammametro.simulation.realtime.domain.VehiclePosition;

import java.time.Instant;
import java.util.List;

/**
 * The seam every source of train positions plugs into — an authorized operator feed, a
 * GTFS-Realtime feed, the timetable, the simulation. {@code MetroStateManager} only ever talks to
 * this interface; no external API is referenced anywhere else in the application.
 *
 * <p>Synchronous on purpose: remote providers are called from the manager's own polling thread
 * (never the simulation's tick thread or an HTTP request thread), with timeouts set by the provider,
 * so a blocking call is simpler than a future and costs nothing.
 *
 * <p>Implementations must never fabricate data: a provider that can't answer throws
 * {@link ProviderException} (or reports {@link #isConfigured()} false) rather than returning
 * placeholder trains.
 */
public interface MetroRealtimeProvider {

    /** The provenance stamped on every train this provider produces. */
    DataSource source();

    /** Human-readable name for logs and the health panel. */
    String name();

    /** False when required configuration (URL, credentials, timetable) is missing — such a
     * provider is reported {@code UNCONFIGURED} and never called. */
    boolean isConfigured();

    /** True for remote providers the manager polls on an interval with backoff; false for local
     * ones (timetable, simulation) that are cheap enough to evaluate on every publish. */
    default boolean isPolled() {
        return true;
    }

    /** How often a polled provider is fetched while healthy. Failures back off from this. */
    default java.time.Duration pollInterval() {
        return java.time.Duration.ofSeconds(15);
    }

    /** How to translate this provider's route/stop/direction identifiers onto the network. */
    default FeedMapping mapping() {
        return FeedMapping.identity();
    }

    List<VehiclePosition> getVehiclePositions(Instant now) throws ProviderException;

    List<TripUpdate> getTripUpdates(Instant now) throws ProviderException;

    List<ServiceAlert> getServiceAlerts(Instant now) throws ProviderException;

    /**
     * One consistent fetch of all three. The default calls each method in turn; providers whose
     * endpoints overlap (e.g. one combined GTFS-Realtime feed) override this to fetch once. Vehicle
     * positions are required; trip-update/alert failures are recorded as warnings rather than
     * discarding positions that did arrive.
     */
    default ProviderSnapshot fetchSnapshot(Instant now) throws ProviderException {
        List<VehiclePosition> positions = getVehiclePositions(now);
        List<String> warnings = new java.util.ArrayList<>();
        List<TripUpdate> tripUpdates = List.of();
        List<ServiceAlert> alerts = List.of();
        try {
            tripUpdates = getTripUpdates(now);
        } catch (ProviderException e) {
            warnings.add("Trip updates unavailable: " + e.getMessage());
        }
        try {
            alerts = getServiceAlerts(now);
        } catch (ProviderException e) {
            warnings.add("Service alerts unavailable: " + e.getMessage());
        }
        return new ProviderSnapshot(positions, tripUpdates, alerts, null, warnings);
    }
}
