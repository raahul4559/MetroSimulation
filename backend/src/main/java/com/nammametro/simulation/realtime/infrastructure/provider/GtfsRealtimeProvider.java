package com.nammametro.simulation.realtime.infrastructure.provider;

import com.google.protobuf.InvalidProtocolBufferException;
import com.google.transit.realtime.GtfsRealtime;
import com.nammametro.simulation.realtime.application.FeedMapping;
import com.nammametro.simulation.realtime.application.MetroRealtimeProvider;
import com.nammametro.simulation.realtime.application.ProviderException;
import com.nammametro.simulation.realtime.domain.DataSource;
import com.nammametro.simulation.realtime.domain.ProviderSnapshot;
import com.nammametro.simulation.realtime.domain.ServiceAlert;
import com.nammametro.simulation.realtime.domain.TripUpdate;
import com.nammametro.simulation.realtime.domain.VehiclePosition;
import com.nammametro.simulation.realtime.domain.VehicleStopStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Any standards-compliant GTFS-Realtime feed (protobuf), configured entirely by URL — nothing about
 * a particular publisher is compiled in. The three endpoints may be one combined feed or separate
 * URLs; each distinct URL is fetched once per poll and every entity type is read from every
 * response. The vehicle-positions endpoint is required; failures of the others degrade to warnings.
 *
 * <p>Only {@code FULL_DATASET} feeds are supported — a {@code DIFFERENTIAL} feed is still parsed but
 * flagged in the warnings, since applying deltas needs state this provider doesn't keep.
 */
public class GtfsRealtimeProvider implements MetroRealtimeProvider {

    private static final String ACCEPT = "application/x-protobuf, application/octet-stream";

    private final HttpFeedClient http;
    private final String vehiclePositionsUrl;
    private final String tripUpdatesUrl;
    private final String alertsUrl;
    private final String authHeaderName;
    private final String authHeaderValue;
    private final Duration pollInterval;
    private final Duration requestTimeout;
    private final FeedMapping mapping;

    public GtfsRealtimeProvider(HttpFeedClient http, String vehiclePositionsUrl, String tripUpdatesUrl, String alertsUrl,
                                String authHeaderName, String authHeaderValue, Duration pollInterval,
                                Duration requestTimeout, FeedMapping mapping) {
        this.http = http;
        this.vehiclePositionsUrl = blankToNull(vehiclePositionsUrl);
        this.tripUpdatesUrl = blankToNull(tripUpdatesUrl);
        this.alertsUrl = blankToNull(alertsUrl);
        this.authHeaderName = authHeaderName;
        this.authHeaderValue = authHeaderValue;
        this.pollInterval = pollInterval;
        this.requestTimeout = requestTimeout;
        this.mapping = mapping;
    }

    @Override
    public DataSource source() {
        return DataSource.GTFS_REALTIME;
    }

    @Override
    public String name() {
        return "GTFS-Realtime";
    }

    @Override
    public boolean isConfigured() {
        return vehiclePositionsUrl != null;
    }

    @Override
    public Duration pollInterval() {
        return pollInterval;
    }

    @Override
    public FeedMapping mapping() {
        return mapping;
    }

    @Override
    public List<VehiclePosition> getVehiclePositions(Instant now) throws ProviderException {
        return parse(fetch(requireConfigured()), now).vehiclePositions();
    }

    @Override
    public List<TripUpdate> getTripUpdates(Instant now) throws ProviderException {
        return tripUpdatesUrl == null ? List.of() : parse(fetch(tripUpdatesUrl), now).tripUpdates();
    }

    @Override
    public List<ServiceAlert> getServiceAlerts(Instant now) throws ProviderException {
        return alertsUrl == null ? List.of() : parse(fetch(alertsUrl), now).serviceAlerts();
    }

    @Override
    public ProviderSnapshot fetchSnapshot(Instant now) throws ProviderException {
        // Distinct URLs in a stable order, positions first: a combined feed is fetched exactly once.
        Map<String, Boolean> urls = new LinkedHashMap<>();
        urls.put(requireConfigured(), true);
        if (tripUpdatesUrl != null) {
            urls.putIfAbsent(tripUpdatesUrl, false);
        }
        if (alertsUrl != null) {
            urls.putIfAbsent(alertsUrl, false);
        }

        List<VehiclePosition> positions = new ArrayList<>();
        List<TripUpdate> updates = new ArrayList<>();
        List<ServiceAlert> alerts = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Instant feedTimestamp = null;
        for (Map.Entry<String, Boolean> entry : urls.entrySet()) {
            ProviderSnapshot part;
            try {
                part = parse(fetch(entry.getKey()), now);
            } catch (ProviderException e) {
                if (entry.getValue()) {
                    throw e;
                }
                warnings.add(e.getMessage());
                continue;
            }
            positions.addAll(part.vehiclePositions());
            updates.addAll(part.tripUpdates());
            alerts.addAll(part.serviceAlerts());
            warnings.addAll(part.warnings());
            if (entry.getValue()) {
                feedTimestamp = part.feedTimestamp();
            }
        }
        return new ProviderSnapshot(positions, updates, alerts, feedTimestamp, warnings);
    }

    private byte[] fetch(String url) throws ProviderException {
        return http.get(url, ACCEPT, authHeaderName, authHeaderValue, requestTimeout);
    }

    private String requireConfigured() throws ProviderException {
        if (vehiclePositionsUrl == null) {
            throw new ProviderException("GTFS-Realtime vehicle positions URL is not configured");
        }
        return vehiclePositionsUrl;
    }

    // --- protobuf -> domain -----------------------------------------------------------------------

    /** Parses one GTFS-Realtime {@code FeedMessage}. Static and I/O-free so it's tested directly. */
    public static ProviderSnapshot parse(byte[] bytes, Instant now) throws ProviderException {
        GtfsRealtime.FeedMessage feed;
        try {
            feed = GtfsRealtime.FeedMessage.parseFrom(bytes);
        } catch (InvalidProtocolBufferException e) {
            throw new ProviderException("Response is not a valid GTFS-Realtime FeedMessage");
        }

        List<String> warnings = new ArrayList<>();
        if (feed.getHeader().getIncrementality() == GtfsRealtime.FeedHeader.Incrementality.DIFFERENTIAL) {
            warnings.add("Feed is DIFFERENTIAL; only FULL_DATASET is fully supported");
        }
        Instant feedTimestamp = feed.getHeader().hasTimestamp() && feed.getHeader().getTimestamp() > 0
                ? Instant.ofEpochSecond(feed.getHeader().getTimestamp()) : null;

        List<VehiclePosition> positions = new ArrayList<>();
        List<TripUpdate> updates = new ArrayList<>();
        List<ServiceAlert> alerts = new ArrayList<>();
        for (GtfsRealtime.FeedEntity entity : feed.getEntityList()) {
            if (entity.getIsDeleted()) {
                continue;
            }
            if (entity.hasVehicle()) {
                positions.add(vehicle(entity.getVehicle()));
            }
            if (entity.hasTripUpdate()) {
                updates.add(tripUpdate(entity.getTripUpdate()));
            }
            if (entity.hasAlert()) {
                alerts.add(alert(entity.getId(), entity.getAlert(), now));
            }
        }
        return new ProviderSnapshot(positions, updates, alerts, feedTimestamp, warnings);
    }

    private static VehiclePosition vehicle(GtfsRealtime.VehiclePosition v) {
        GtfsRealtime.TripDescriptor trip = v.getTrip();
        GtfsRealtime.Position p = v.hasPosition() ? v.getPosition() : null;
        return new VehiclePosition(
                v.hasVehicle() ? blankToNull(v.getVehicle().getId()) : null,
                v.hasVehicle() ? blankToNull(v.getVehicle().getLabel()) : null,
                v.hasTrip() ? blankToNull(trip.getTripId()) : null,
                v.hasTrip() ? blankToNull(trip.getRouteId()) : null,
                v.hasTrip() && trip.hasDirectionId() ? trip.getDirectionId() : null,
                blankToNull(v.getStopId()),
                v.hasCurrentStatus() ? VehicleStopStatus.valueOf(v.getCurrentStatus().name()) : null,
                p != null ? (double) p.getLatitude() : null,
                p != null ? (double) p.getLongitude() : null,
                p != null && p.hasBearing() ? (double) p.getBearing() : null,
                p != null && p.hasSpeed() ? (double) p.getSpeed() : null,
                v.hasTimestamp() && v.getTimestamp() > 0 ? Instant.ofEpochSecond(v.getTimestamp()) : null);
    }

    private static TripUpdate tripUpdate(GtfsRealtime.TripUpdate u) {
        List<TripUpdate.StopTimeUpdate> stops = new ArrayList<>();
        for (GtfsRealtime.TripUpdate.StopTimeUpdate s : u.getStopTimeUpdateList()) {
            Integer delay = s.hasArrival() && s.getArrival().hasDelay() ? Integer.valueOf(s.getArrival().getDelay())
                    : s.hasDeparture() && s.getDeparture().hasDelay() ? Integer.valueOf(s.getDeparture().getDelay())
                    : null;
            stops.add(new TripUpdate.StopTimeUpdate(
                    blankToNull(s.getStopId()),
                    s.hasStopSequence() ? s.getStopSequence() : null,
                    s.hasArrival() && s.getArrival().hasTime() ? Instant.ofEpochSecond(s.getArrival().getTime()) : null,
                    s.hasDeparture() && s.getDeparture().hasTime() ? Instant.ofEpochSecond(s.getDeparture().getTime()) : null,
                    delay,
                    s.getScheduleRelationship() == GtfsRealtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED));
        }
        GtfsRealtime.TripDescriptor trip = u.getTrip();
        return new TripUpdate(
                blankToNull(trip.getTripId()),
                blankToNull(trip.getRouteId()),
                trip.hasDirectionId() ? trip.getDirectionId() : null,
                u.hasVehicle() ? blankToNull(u.getVehicle().getId()) : null,
                stops,
                u.hasTimestamp() && u.getTimestamp() > 0 ? Instant.ofEpochSecond(u.getTimestamp()) : null);
    }

    private static ServiceAlert alert(String id, GtfsRealtime.Alert a, Instant now) {
        Instant from = null;
        Instant until = null;
        // Prefer the period covering now; otherwise the first listed. No period means "always".
        for (GtfsRealtime.TimeRange range : a.getActivePeriodList()) {
            Instant start = range.hasStart() && range.getStart() > 0 ? Instant.ofEpochSecond(range.getStart()) : null;
            Instant end = range.hasEnd() && range.getEnd() > 0 ? Instant.ofEpochSecond(range.getEnd()) : null;
            boolean covers = (start == null || !now.isBefore(start)) && (end == null || now.isBefore(end));
            if (covers || (from == null && until == null)) {
                from = start;
                until = end;
            }
            if (covers) {
                break;
            }
        }
        List<String> routes = new ArrayList<>();
        List<String> stops = new ArrayList<>();
        for (GtfsRealtime.EntitySelector selector : a.getInformedEntityList()) {
            if (selector.hasRouteId()) {
                routes.add(selector.getRouteId());
            }
            if (selector.hasStopId()) {
                stops.add(selector.getStopId());
            }
        }
        ServiceAlert.AlertSeverity severity = switch (a.hasSeverityLevel() ? a.getSeverityLevel().name() : "") {
            case "INFO" -> ServiceAlert.AlertSeverity.INFO;
            case "WARNING" -> ServiceAlert.AlertSeverity.WARNING;
            case "SEVERE" -> ServiceAlert.AlertSeverity.SEVERE;
            default -> ServiceAlert.AlertSeverity.UNKNOWN;
        };
        return new ServiceAlert(blankToNull(id), a.hasCause() ? a.getCause().name() : null,
                a.hasEffect() ? a.getEffect().name() : null, severity, text(a.getHeaderText()),
                text(a.getDescriptionText()), from, until, routes, stops);
    }

    /** English if offered, else the first translation. */
    private static String text(GtfsRealtime.TranslatedString translated) {
        String first = null;
        for (GtfsRealtime.TranslatedString.Translation t : translated.getTranslationList()) {
            if (first == null) {
                first = t.getText();
            }
            if (t.getLanguage().toLowerCase().startsWith("en")) {
                return t.getText();
            }
        }
        return blankToNull(first);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
