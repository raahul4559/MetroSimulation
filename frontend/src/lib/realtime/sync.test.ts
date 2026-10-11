import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Line, Station, Track } from "@/domain/metro";
import type { MetroStateFrame, ServiceStatus } from "@/domain/realtime";
import type { TrainState } from "@/domain/trainsim";
import { resolveTrainPhase } from "@/lib/station3d/trainVisual";
import { trainPose3D } from "@/lib/station3d/position";
import { getStationArrivals } from "@/lib/metro/stationArrivals";
import { deriveDiagnostics } from "./diagnostics";
import { describeFeed, trainSourceLabel } from "./provenance";

function train(overrides: Partial<TrainState>): TrainState {
  return {
    id: 7, code: "T7", lineCode: "PURPLE", direction: "OUTBOUND", currentTrackId: 11, previousStationId: 1,
    nextStationId: 2, progress: 0, speedKmph: 60, status: "RUNNING", passengerCount: null, capacity: null,
    delaySeconds: null, nextStationEta: null, latitude: null, longitude: null, scheduledDepartureSeconds: null,
    dwellTimeSeconds: null, maxSpeedKmph: null, accelerationMps2: null, brakingRateMps2: null,
    scheduledArrivalSeconds: null, actualArrivalSeconds: null, actualDepartureSeconds: null, source: "GTFS_REALTIME",
    vehicleId: "v7", tripId: null, observedAt: "2026-10-12T04:00:00Z", stale: false, positionEstimated: false,
    ...overrides,
  };
}

const PLATFORM = { moduleIndex: 0 };
const B = 2;

/** The scene z of a train relative to station B, through the same two functions MetroTrain3D uses. */
function sceneZ(t: TrainState): number | null {
  const resolved = resolveTrainPhase(t, B);
  return resolved ? trainPose3D(PLATFORM, t.direction, resolved.phase, resolved.localProgress).z : null;
}

describe("3D pose from the shared train state", () => {
  it("is continuous through approach, arrival, the stop and departure", () => {
    const approaching = sceneZ(train({ progress: 0.9999, status: "RUNNING" }))!;
    const arriving = sceneZ(train({ progress: 0.9999, status: "ARRIVING" }))!;
    const stopped = sceneZ(train({ previousStationId: B, nextStationId: B, currentTrackId: null, status: "DWELLING" }))!;
    const departing = sceneZ(train({ previousStationId: B, nextStationId: 3, currentTrackId: 12, progress: 0.0001, status: "DEPARTING" }))!;
    for (const z of [approaching, arriving, departing]) assert.ok(Math.abs(z - stopped) < 0.05, `jump to ${z}`);
  });

  it("is out of the scene while the train is far out on the line", () => {
    assert.equal(sceneZ(train({ progress: 0.3 })), null);
  });
});

describe("station arrivals", () => {
  const station = { id: B, name: "B", lines: ["PURPLE"] } as unknown as Station;
  const line = { code: "PURPLE", stations: [{ id: 1 }, { id: B }, { id: 3 }] } as unknown as Line;
  const tracks = [{ id: 11, expectedTravelTimeSeconds: 60 }] as Track[];
  const now = Date.parse("2026-10-12T04:00:00Z");

  it("uses the feed's predicted arrival against server time", () => {
    const t = train({ progress: 0.5, nextStationEta: "2026-10-12T04:00:42Z" });
    const [arrival] = getStationArrivals(station, [t], tracks, [line], now);
    assert.equal(arrival?.etaSeconds, 42);
    assert.equal(arrival?.etaBasis, "PREDICTED");
  });

  it("falls back to nominal running time when there is no prediction, or it is stale", () => {
    const stale = train({ progress: 0.5, nextStationEta: "2026-10-12T04:00:42Z", stale: true });
    const [arrival] = getStationArrivals(station, [stale], tracks, [line], now);
    assert.equal(arrival?.etaSeconds, 30);
    assert.equal(arrival?.etaBasis, "NOMINAL");
  });
});

describe("diagnostics and labels", () => {
  function frame(overrides: Partial<MetroStateFrame>): MetroStateFrame {
    return {
      instanceId: "i", version: 1, serverTime: "", serverTimeIst: "", serverEpochMillis: Date.parse("2026-10-12T04:01:00Z"),
      timezone: "Asia/Kolkata", serviceDay: "2026-10-12", dayType: "WEEKDAY", requestedMode: "AUTO",
      activeSource: "GTFS_REALTIME", isLive: true, activeSourceStale: false, sourceReason: "Auto: using GTFS",
      providers: [], service: {} as ServiceStatus, trains: [], alerts: [], simulation: null, ...overrides,
    };
  }

  it("counts fresh, interpolated and stale positions and ages the newest observation", () => {
    const f = frame({
      trains: [
        train({ id: 1, observedAt: "2026-10-12T04:00:50Z" }),
        train({ id: 2, observedAt: "2026-10-12T04:00:40Z", positionEstimated: true }),
        train({ id: 3, observedAt: "2026-10-12T03:58:00Z", stale: true, positionEstimated: true }),
      ],
    });
    const d = deriveDiagnostics(f, Date.parse("2026-10-12T04:01:05Z"));
    assert.equal(d.trainCount, 3);
    assert.equal(d.freshCount, 2);
    assert.equal(d.estimatedCount, 1);
    assert.equal(d.staleCount, 1);
    assert.equal(d.dataAgeMs, 15_000);
    assert.equal(d.frameAgeMs, 5_000);
  });

  it("never calls a simulation, a timetable, a stale feed or a stalled stream live", () => {
    assert.equal(describeFeed(frame({ activeSource: "SIMULATION", isLive: false }), "connected", false).isLive, false);
    assert.equal(describeFeed(frame({ activeSource: "SCHEDULE", isLive: false }), "connected", false).label, "Timetable estimate");
    const stale = describeFeed(
      frame({ isLive: false, activeSourceStale: true, trains: [train({ stale: true })] }),
      "connected",
      false,
    );
    assert.equal(stale.isLive, false);
    assert.match(stale.label, /stale · estimated/);
    assert.equal(describeFeed(frame({}), "connected", true).isLive, false);
    assert.equal(describeFeed(frame({}), "connected", false).isLive, true);
    assert.equal(trainSourceLabel(train({ stale: true })), "GTFS-RT · estimated (stale)");
  });
});
