package com.nammametro.simulation.realtime.infrastructure.provider;

import com.nammametro.simulation.realtime.application.FeedMapping;
import com.nammametro.simulation.realtime.application.MetroRealtimeProvider;
import com.nammametro.simulation.realtime.application.ProviderException;
import com.nammametro.simulation.realtime.domain.DataSource;
import com.nammametro.simulation.realtime.domain.ProviderSnapshot;
import com.nammametro.simulation.realtime.domain.ServiceAlert;
import com.nammametro.simulation.realtime.domain.TripUpdate;
import com.nammametro.simulation.realtime.domain.VehiclePosition;
import com.nammametro.simulation.realtime.domain.VehicleStopStatus;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * An authorized/official operator feed — the {@link DataSource#LIVE} source.
 *
 * <p>No public BMRCL realtime API is known to exist, so this provider is not written against one.
 * It reads the vendor-neutral JSON contract documented in {@code docs/realtime.md} from a configured
 * URL. An authorized integration either serves that contract directly, or gets a small adapter that
 * translates its own format into it — the rest of the application never changes. With no URL
 * configured it is {@code UNCONFIGURED} and never contacted.
 *
 * <p>Parsing is tolerant per entry: a malformed vehicle is skipped and counted in the snapshot's
 * warnings rather than failing the whole fetch; a payload that isn't JSON at all fails the fetch.
 */
public class OfficialRealtimeProvider implements MetroRealtimeProvider {

    private final HttpFeedClient http;
    private final ObjectMapper json;
    private final String url;
    private final String authHeaderName;
    private final String authHeaderValue;
    private final Duration pollInterval;
    private final Duration requestTimeout;
    private final FeedMapping mapping;

    public OfficialRealtimeProvider(HttpFeedClient http, ObjectMapper json, String url, String authHeaderName,
                                    String authHeaderValue, Duration pollInterval, Duration requestTimeout,
                                    FeedMapping mapping) {
        this.http = http;
        this.json = json;
        this.url = url == null || url.isBlank() ? null : url;
        this.authHeaderName = authHeaderName;
        this.authHeaderValue = authHeaderValue;
        this.pollInterval = pollInterval;
        this.requestTimeout = requestTimeout;
        this.mapping = mapping;
    }

    @Override
    public DataSource source() {
        return DataSource.LIVE;
    }

    @Override
    public String name() {
        return "Official live feed";
    }

    @Override
    public boolean isConfigured() {
        return url != null;
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
        return fetchSnapshot(now).vehiclePositions();
    }

    @Override
    public List<TripUpdate> getTripUpdates(Instant now) throws ProviderException {
        return fetchSnapshot(now).tripUpdates();
    }

    @Override
    public List<ServiceAlert> getServiceAlerts(Instant now) throws ProviderException {
        return fetchSnapshot(now).serviceAlerts();
    }

    /** One request carries all three collections in this contract. */
    @Override
    public ProviderSnapshot fetchSnapshot(Instant now) throws ProviderException {
        if (url == null) {
            throw new ProviderException("Official feed URL is not configured");
        }
        return parse(json, http.get(url, "application/json", authHeaderName, authHeaderValue, requestTimeout));
    }

    public static ProviderSnapshot parse(ObjectMapper json, byte[] body) throws ProviderException {
        JsonNode root;
        try {
            root = json.readTree(body);
        } catch (JacksonException e) {
            throw new ProviderException("Official feed response is not valid JSON");
        }
        if (root == null || !root.isObject()) {
            throw new ProviderException("Official feed response is not a JSON object");
        }

        List<String> warnings = new ArrayList<>();
        int malformed = 0;

        List<VehiclePosition> vehicles = new ArrayList<>();
        for (JsonNode v : root.path("vehicles")) {
            try {
                vehicles.add(new VehiclePosition(
                        text(v, "vehicleId"), text(v, "label"), text(v, "tripId"), text(v, "routeId"),
                        integer(v, "directionId"), text(v, "stopId"), status(text(v, "status")),
                        number(v, "latitude"), number(v, "longitude"), number(v, "bearing"), number(v, "speedMps"),
                        instant(v, "timestamp")));
            } catch (IllegalArgumentException | DateTimeParseException e) {
                malformed++;
            }
        }

        List<TripUpdate> updates = new ArrayList<>();
        for (JsonNode u : root.path("tripUpdates")) {
            try {
                List<TripUpdate.StopTimeUpdate> stops = new ArrayList<>();
                for (JsonNode s : u.path("stops")) {
                    stops.add(new TripUpdate.StopTimeUpdate(text(s, "stopId"), integer(s, "sequence"),
                            instant(s, "arrival"), instant(s, "departure"), integer(s, "delaySeconds"),
                            s.path("skipped").asBoolean(false)));
                }
                updates.add(new TripUpdate(text(u, "tripId"), text(u, "routeId"), integer(u, "directionId"),
                        text(u, "vehicleId"), stops, instant(u, "timestamp")));
            } catch (IllegalArgumentException | DateTimeParseException e) {
                malformed++;
            }
        }

        List<ServiceAlert> alerts = new ArrayList<>();
        for (JsonNode a : root.path("alerts")) {
            try {
                alerts.add(new ServiceAlert(text(a, "id"), text(a, "cause"), text(a, "effect"),
                        severity(text(a, "severity")), text(a, "header"), text(a, "description"),
                        instant(a, "activeFrom"), instant(a, "activeUntil"), strings(a, "routeIds"),
                        strings(a, "stopIds")));
            } catch (IllegalArgumentException | DateTimeParseException e) {
                malformed++;
            }
        }

        if (malformed > 0) {
            warnings.add("%d malformed entr%s skipped".formatted(malformed, malformed == 1 ? "y" : "ies"));
        }
        Instant generatedAt;
        try {
            generatedAt = instant(root, "generatedAt");
        } catch (IllegalArgumentException | DateTimeParseException e) {
            generatedAt = null;
            warnings.add("generatedAt is not a valid timestamp");
        }
        return new ProviderSnapshot(vehicles, updates, alerts, generatedAt, warnings);
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        String text = value.asString();
        return text.isBlank() ? null : text;
    }

    private static Double number(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        if (!value.isNumber()) {
            throw new IllegalArgumentException(field + " is not a number");
        }
        return value.asDouble();
    }

    private static Integer integer(JsonNode node, String field) {
        Double value = number(node, field);
        return value == null ? null : value.intValue();
    }

    /** ISO-8601 string or epoch seconds. */
    private static Instant instant(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        if (value.isNumber()) {
            return Instant.ofEpochSecond(value.asLong());
        }
        return Instant.parse(value.asString());
    }

    private static List<String> strings(JsonNode node, String field) {
        List<String> values = new ArrayList<>();
        for (JsonNode value : node.path(field)) {
            if (!value.isNull() && !value.asString().isBlank()) {
                values.add(value.asString());
            }
        }
        return values;
    }

    private static VehicleStopStatus status(String value) {
        return value == null ? null : VehicleStopStatus.valueOf(value.toUpperCase(Locale.ROOT));
    }

    private static ServiceAlert.AlertSeverity severity(String value) {
        if (value == null) {
            return ServiceAlert.AlertSeverity.UNKNOWN;
        }
        try {
            return ServiceAlert.AlertSeverity.valueOf(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return ServiceAlert.AlertSeverity.UNKNOWN;
        }
    }
}
