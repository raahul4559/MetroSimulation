import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LineStatus, MetroStateFrame, ProviderHealth, ServiceStatus } from "@/domain/realtime";
import type { TrainState } from "@/domain/trainsim";
import {
  delayDataState,
  describeDataState,
  describeTrainDataState,
  simulationOnlyDataState,
} from "./dataState";
import { deriveStationStatus } from "./stationStatus";

const NOW = Date.parse("2026-10-12T04:01:00Z");

function train(overrides: Partial<TrainState> = {}): TrainState {
  return {
    id: 7, code: "T7", lineCode: "PURPLE", direction: "OUTBOUND", currentTrackId: 11, previousStationId: 1,
    nextStationId: 2, progress: 0, speedKmph: 60, status: "RUNNING", passengerCount: null, capacity: null,
    delaySeconds: null, nextStationEta: null, latitude: null, longitude: null, scheduledDepartureSeconds: null,
    dwellTimeSeconds: null, maxSpeedKmph: null, accelerationMps2: null, brakingRateMps2: null,
    scheduledArrivalSeconds: null, actualArrivalSeconds: null, actualDepartureSeconds: null, source: "GTFS_REALTIME",
    vehicleId: "v7", tripId: null, observedAt: "2026-10-12T04:00:54Z", stale: false, positionEstimated: false,
    ...overrides,
  };
}

function provider(overrides: Partial<ProviderHealth>): ProviderHealth {
  return {
    source: "LIVE", name: "Official live feed", status: "UNCONFIGURED", detail: null, lastAttemptAt: null,
    lastSuccessAt: null, feedTimestamp: null, nextAttemptAt: null, consecutiveFailures: 0, acceptedVehicles: 0,
    rejectedVehicles: 0, rejectionReasons: {}, warnings: [], ...overrides,
  };
}

function frame(overrides: Partial<MetroStateFrame> = {}): MetroStateFrame {
  return {
    instanceId: "i", version: 1, serverTime: "", serverTimeIst: "", serverEpochMillis: NOW,
    timezone: "Asia/Kolkata", serviceDay: "2026-10-12", dayType: "MONDAY", requestedMode: "AUTO",
    activeSource: "GTFS_REALTIME", isLive: true, activeSourceStale: false, sourceReason: "Auto: GTFS-RT",
    providers: [], service: {} as ServiceStatus, trains: [train()], alerts: [], simulation: null, ...overrides,
  };
}

describe("network data state", () => {
  it("is LIVE only for a fresh observed feed that is still arriving, with its age", () => {
    const live = describeDataState(frame(), "connected", false, NOW);
    assert.equal(live.kind, "LIVE");
    assert.equal(live.caption, "Updated 6s ago");
  });

  it("never calls the timetable or the simulation live, however healthy the socket", () => {
    const schedule = describeDataState(frame({ activeSource: "SCHEDULE", isLive: false }), "connected", false, NOW);
    assert.equal(schedule.kind, "ESTIMATED");
    assert.equal(schedule.caption, "Based on schedule");
    const sim = describeDataState(frame({ activeSource: "SIMULATION", isLive: false }), "connected", false, NOW);
    assert.equal(sim.kind, "SIMULATED");
    // Even a frame that wrongly claimed isLive for a non-observed source stays non-live.
    assert.notEqual(describeDataState(frame({ activeSource: "SCHEDULE", isLive: true }), "connected", false, NOW).kind, "LIVE");
  });

  it("says the realtime feed is unavailable when it fell back from a failing feed", () => {
    const fallback = describeDataState(
      frame({ activeSource: "SCHEDULE", isLive: false, providers: [provider({ status: "ERROR" })] }),
      "connected",
      false,
      NOW,
    );
    assert.equal(fallback.kind, "ESTIMATED");
    assert.equal(fallback.caption, "Realtime feed unavailable · based on schedule");
  });

  it("goes OFFLINE when the socket drops or frames stall, and keeps ageing", () => {
    const dropped = describeDataState(frame(), "disconnected", false, NOW + 20_000);
    assert.equal(dropped.kind, "OFFLINE");
    assert.match(dropped.caption, /^Realtime feed unavailable · last update 20s ago$/);
    assert.equal(describeDataState(frame(), "connected", true, NOW).kind, "OFFLINE");
    assert.equal(describeDataState(null, "disconnected", false, NOW).kind, "OFFLINE");
    assert.equal(describeDataState(null, "connecting", false, NOW).kind, "CONNECTING");
  });

  it("marks a stale observed feed STALE, not LIVE", () => {
    const stale = describeDataState(frame({ isLive: false, activeSourceStale: true }), "connected", false, NOW);
    assert.equal(stale.kind, "STALE");
  });
});

describe("train data state", () => {
  const live = describeDataState(frame(), "connected", false, NOW);

  it("is LIVE with the train's own report age inside a live frame", () => {
    const s = describeTrainDataState(train(), live, NOW + 1_000);
    assert.equal(s.kind, "LIVE");
    assert.equal(s.caption, "Updated 7s ago");
  });

  it("is ESTIMATED for interpolated or scheduled positions and STALE for a lost train", () => {
    assert.equal(describeTrainDataState(train({ positionEstimated: true }), live, NOW).kind, "ESTIMATED");
    assert.equal(describeTrainDataState(train({ source: "SCHEDULE" }), live, NOW).caption, "Based on schedule");
    assert.equal(describeTrainDataState(train({ stale: true }), live, NOW).kind, "STALE");
    assert.equal(describeTrainDataState(train({ source: "SIMULATION" }), live, NOW).kind, "SIMULATED");
  });

  it("is never better than the network: an offline browser makes every train offline", () => {
    const offline = describeDataState(frame(), "disconnected", false, NOW);
    assert.equal(describeTrainDataState(train(), offline, NOW).kind, "OFFLINE");
    const notLive = describeDataState(frame({ isLive: false, activeSourceStale: true }), "connected", false, NOW);
    assert.notEqual(describeTrainDataState(train(), notLive, NOW).kind, "LIVE");
  });
});

describe("panels whose data only some sources report", () => {
  const schedule = describeDataState(frame({ activeSource: "SCHEDULE", isLive: false }), "connected", false, NOW);

  it("shows passenger data as unavailable outside the simulation", () => {
    assert.equal(simulationOnlyDataState(schedule, false).kind, "UNAVAILABLE");
    const sim = describeDataState(frame({ activeSource: "SIMULATION", isLive: false }), "connected", false, NOW);
    assert.equal(simulationOnlyDataState(sim, true).kind, "SIMULATED");
  });

  it("shows delays as unreported, not as on time, when no train carries a delay", () => {
    assert.equal(delayDataState(schedule, 0, 4).kind, "UNAVAILABLE");
    assert.equal(delayDataState(schedule, 2, 4).kind, "ESTIMATED");
  });
});

describe("station status", () => {
  function service(lines: Partial<LineStatus>[]): ServiceStatus {
    return {
      timetableConfigured: true,
      lines: lines.map((l) => ({
        lineCode: "PURPLE", state: "OPERATING", basis: "TIMETABLE", reason: null, firstDeparture: "05:00",
        lastDeparture: "23:05", nextServiceAt: null, nextServiceAtIst: null, trainsReported: 0, alertIds: [], ...l,
      })),
    } as unknown as ServiceStatus;
  }
  const majestic = { id: 5, lines: ["PURPLE", "GREEN"] };

  it("is never assumed: no status yet reads unknown", () => {
    assert.equal(deriveStationStatus(majestic, null, [], []).label, "Status unknown");
  });

  it("follows its lines' timetable status", () => {
    assert.equal(deriveStationStatus(majestic, service([{}]), [], []).label, "In service");
    assert.equal(
      deriveStationStatus(majestic, service([{ state: "NOT_STARTED", firstDeparture: "04:15" }]), [], []).label,
      "Opens 04:15",
    );
    assert.equal(deriveStationStatus(majestic, service([{ state: "ENDED" }]), [], []).label, "Closed for the night");
  });

  it("puts an alert naming the station or its line ahead of the timetable", () => {
    const alert = {
      id: "a", source: "GTFS_REALTIME", cause: null, effect: null, severity: "SEVERE", headerText: "Platform closed",
      descriptionText: null, activeFrom: null, activeUntil: null, lineCodes: [], stationIds: [5],
    } as const;
    const status = deriveStationStatus(majestic, service([{}]), [alert], []);
    assert.equal(status.label, "Disrupted");
    assert.equal(status.detail, "Platform closed");
  });
});
