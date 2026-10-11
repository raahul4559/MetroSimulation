package com.nammametro.simulation.realtime.infrastructure.provider;

import com.google.transit.realtime.GtfsRealtime;
import com.nammametro.simulation.realtime.application.ProviderException;
import com.nammametro.simulation.realtime.domain.ProviderSnapshot;
import com.nammametro.simulation.realtime.domain.ServiceAlert;
import com.nammametro.simulation.realtime.domain.VehicleStopStatus;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProviderParsingTest {

    private static final Instant NOW = Instant.parse("2026-10-12T04:00:00Z");
    private static final ObjectMapper JSON = JsonMapper.builder().build();

    @Test
    void gtfsRealtimeFeedMessageIsParsedIntoDomainShapes() throws Exception {
        GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.newBuilder()
                .setHeader(GtfsRealtime.FeedHeader.newBuilder().setGtfsRealtimeVersion("2.0")
                        .setTimestamp(NOW.getEpochSecond()))
                .addEntity(GtfsRealtime.FeedEntity.newBuilder().setId("e1")
                        .setVehicle(GtfsRealtime.VehiclePosition.newBuilder()
                                .setVehicle(GtfsRealtime.VehicleDescriptor.newBuilder().setId("train-17").setLabel("17"))
                                .setTrip(GtfsRealtime.TripDescriptor.newBuilder().setTripId("t1").setRouteId("PURPLE").setDirectionId(1))
                                .setStopId("B")
                                .setCurrentStatus(GtfsRealtime.VehiclePosition.VehicleStopStatus.STOPPED_AT)
                                .setPosition(GtfsRealtime.Position.newBuilder().setLatitude(12.97f).setLongitude(77.51f))
                                .setTimestamp(NOW.getEpochSecond() - 5)))
                .addEntity(GtfsRealtime.FeedEntity.newBuilder().setId("deleted").setIsDeleted(true)
                        .setVehicle(GtfsRealtime.VehiclePosition.newBuilder()))
                .addEntity(GtfsRealtime.FeedEntity.newBuilder().setId("alert-1")
                        .setAlert(GtfsRealtime.Alert.newBuilder()
                                .setEffect(GtfsRealtime.Alert.Effect.NO_SERVICE)
                                .addInformedEntity(GtfsRealtime.EntitySelector.newBuilder().setRouteId("PURPLE"))
                                .setHeaderText(GtfsRealtime.TranslatedString.newBuilder()
                                        .addTranslation(GtfsRealtime.TranslatedString.Translation.newBuilder().setText("ಸೇವೆ ಸ್ಥಗಿತ").setLanguage("kn"))
                                        .addTranslation(GtfsRealtime.TranslatedString.Translation.newBuilder().setText("Service suspended").setLanguage("en")))))
                .build();

        ProviderSnapshot snapshot = GtfsRealtimeProvider.parse(feed.toByteArray(), NOW);

        assertThat(snapshot.feedTimestamp()).isEqualTo(NOW);
        assertThat(snapshot.vehiclePositions()).singleElement().satisfies(v -> {
            assertThat(v.vehicleId()).isEqualTo("train-17");
            assertThat(v.directionId()).isEqualTo(1);
            assertThat(v.currentStatus()).isEqualTo(VehicleStopStatus.STOPPED_AT);
            assertThat(v.timestamp()).isEqualTo(NOW.minusSeconds(5));
        });
        assertThat(snapshot.serviceAlerts()).singleElement().satisfies(a -> {
            assertThat(a.effect()).isEqualTo("NO_SERVICE");
            assertThat(a.headerText()).isEqualTo("Service suspended");
            assertThat(a.routeIds()).containsExactly("PURPLE");
        });
    }

    @Test
    void garbageIsAProviderErrorNotAnEmptyFeed() {
        assertThatThrownBy(() -> GtfsRealtimeProvider.parse("<html>maintenance</html>".getBytes(StandardCharsets.UTF_8), NOW))
                .isInstanceOf(ProviderException.class);
        assertThatThrownBy(() -> OfficialRealtimeProvider.parse(JSON, "not json".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(ProviderException.class);
    }

    @Test
    void officialJsonContractIsParsedAndMalformedEntriesAreSkipped() throws Exception {
        String body = """
                {
                  "generatedAt": "2026-10-12T04:00:00Z",
                  "vehicles": [
                    {"vehicleId": "T1", "routeId": "PURPLE", "directionId": 0, "stopId": "B", "status": "stopped_at",
                     "latitude": 12.97, "longitude": 77.51, "timestamp": 1791777600},
                    {"vehicleId": "T2", "latitude": "north-ish"}
                  ],
                  "tripUpdates": [
                    {"tripId": "x", "vehicleId": "T1", "stops": [{"stopId": "C", "arrival": "2026-10-12T04:01:30Z", "delaySeconds": 30}]}
                  ],
                  "alerts": [{"id": "a", "severity": "warning", "header": "Slow running", "routeIds": ["PURPLE"]}]
                }
                """;

        ProviderSnapshot snapshot = OfficialRealtimeProvider.parse(JSON, body.getBytes(StandardCharsets.UTF_8));

        assertThat(snapshot.feedTimestamp()).isEqualTo(NOW);
        assertThat(snapshot.vehiclePositions()).singleElement().satisfies(v -> {
            assertThat(v.vehicleId()).isEqualTo("T1");
            assertThat(v.currentStatus()).isEqualTo(VehicleStopStatus.STOPPED_AT);
            assertThat(v.timestamp()).isEqualTo(Instant.ofEpochSecond(1791777600));
        });
        assertThat(snapshot.tripUpdates().getFirst().stopTimeUpdates().getFirst().delaySeconds()).isEqualTo(30);
        assertThat(snapshot.serviceAlerts().getFirst().severity()).isEqualTo(ServiceAlert.AlertSeverity.WARNING);
        assertThat(snapshot.warnings()).containsExactly("1 malformed entry skipped");
    }

    @Test
    void errorMessagesNeverIncludeTheQueryStringWhereKeysLive() {
        assertThat(HttpFeedClient.redacted(URI.create("https://user:pw@feed.example/vp.pb?api_key=SECRET#x")))
                .isEqualTo("https://feed.example/vp.pb");
    }

    @Test
    void unconfiguredRemoteProvidersSayWhy() {
        var provider = new GtfsRealtimeProvider(new HttpFeedClient(), "", "", "", "", "",
                java.time.Duration.ofSeconds(15), java.time.Duration.ofSeconds(10),
                com.nammametro.simulation.realtime.application.FeedMapping.identity());
        assertThat(provider.isConfigured()).isFalse();
        assertThatThrownBy(() -> provider.fetchSnapshot(NOW)).isInstanceOf(ProviderException.class)
                .hasMessageContaining("not configured");
    }
}
