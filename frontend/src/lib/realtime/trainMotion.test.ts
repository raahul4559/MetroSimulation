import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Line, Station, Track } from "@/domain/metro";
import type { TrainState } from "@/domain/trainsim";
import { TrainMotionStore } from "./trainMotion";

// Line PURPLE: A(1) - B(2) - C(3) - D(4); outbound runs A -> D.
const station = (id: number, code: string) => ({ id, code, name: code }) as unknown as Station;
const LINE = { id: 1, code: "PURPLE", name: "Purple", colorHex: "#800080", stations: [station(1, "A"), station(2, "B"), station(3, "C"), station(4, "D")] } as Line;
const TRACKS = [
  { id: 11, lineCode: "PURPLE", fromStationId: 1, toStationId: 2, distanceMetres: 1000, expectedTravelTimeSeconds: 60, geometry: [] },
  { id: 12, lineCode: "PURPLE", fromStationId: 2, toStationId: 3, distanceMetres: 1000, expectedTravelTimeSeconds: 60, geometry: [] },
  { id: 13, lineCode: "PURPLE", fromStationId: 3, toStationId: 4, distanceMetres: 1000, expectedTravelTimeSeconds: 60, geometry: [] },
] as Track[];

function train(overrides: Partial<TrainState>): TrainState {
  return {
    id: 7, code: "T7", lineCode: "PURPLE", direction: "OUTBOUND", currentTrackId: 11, previousStationId: 1,
    nextStationId: 2, progress: 0, speedKmph: 60, status: "RUNNING", passengerCount: null, capacity: null,
    delaySeconds: 45, nextStationEta: null, latitude: null, longitude: null, scheduledDepartureSeconds: null,
    dwellTimeSeconds: null, maxSpeedKmph: null, accelerationMps2: null, brakingRateMps2: null,
    scheduledArrivalSeconds: null, actualArrivalSeconds: null, actualDepartureSeconds: null, source: "GTFS_REALTIME",
    vehicleId: "v7", tripId: null, observedAt: "2026-10-12T04:00:00Z", stale: false, positionEstimated: false,
    ...overrides,
  };
}

function store(): TrainMotionStore {
  const s = new TrainMotionStore();
  s.setNetwork([LINE], TRACKS);
  return s;
}

describe("TrainMotionStore", () => {
  it("draws a newly seen train exactly at its canonical position", () => {
    const s = store();
    s.ingest([train({ progress: 0.4 })], 1_000, 0);
    assert.equal(s.sample(7, 0)?.progress, 0.4);
  });

  it("blends over the server-time interval between frames and lands on the canonical state", () => {
    const s = store();
    s.ingest([train({ progress: 0.2 })], 1_000, 0);
    s.ingest([train({ progress: 0.6 })], 3_000, 10); // frames 2 s apart in server time

    const mid = s.sample(7, 1_010)!;
    assert.ok(Math.abs(mid.progress - 0.4) < 1e-9, `expected 0.4, got ${mid.progress}`);
    assert.equal(s.isAnimating(1_010), true);
    assert.equal(s.sample(7, 2_010)?.progress, 0.6);
    assert.equal(s.isAnimating(2_010), false);
  });

  it("follows the track through a station instead of cutting across it", () => {
    const s = store();
    s.ingest([train({ previousStationId: 1, nextStationId: 2, progress: 0.8, currentTrackId: 11 })], 1_000, 0);
    s.ingest([train({ previousStationId: 2, nextStationId: 3, progress: 0.2, currentTrackId: 12 })], 2_000, 0);

    const first = s.sample(7, 250)!; // 1.8 -> 2.2 along the axis; a quarter of the way is 1.9
    assert.equal(first.previousStationId, 1);
    assert.equal(first.nextStationId, 2);
    assert.equal(first.currentTrackId, 11);
    assert.ok(Math.abs(first.progress - 0.9) < 1e-9);
    assert.equal(first.status, "RUNNING");

    const later = s.sample(7, 750)!; // 2.1 -> on B -> C
    assert.equal(later.previousStationId, 2);
    assert.equal(later.currentTrackId, 12);
  });

  it("decodes inbound trains against the line order", () => {
    const s = store();
    const inbound = { direction: "INBOUND" as const, previousStationId: 3, nextStationId: 2, currentTrackId: 12 };
    s.ingest([train({ ...inbound, progress: 0.0 })], 1_000, 0);
    s.ingest([train({ ...inbound, progress: 0.5 })], 2_000, 0);

    const mid = s.sample(7, 500)!;
    assert.equal(mid.previousStationId, 3);
    assert.equal(mid.nextStationId, 2);
    assert.ok(Math.abs(mid.progress - 0.25) < 1e-9);
  });

  it("reports ARRIVING while catching up to a train the frame already has at the platform", () => {
    const s = store();
    s.ingest([train({ progress: 0.9 })], 1_000, 0);
    s.ingest([train({ previousStationId: 2, nextStationId: 2, progress: 0, currentTrackId: null, status: "DWELLING" })], 2_000, 0);

    const catchingUp = s.sample(7, 500)!;
    assert.equal(catchingUp.status, "ARRIVING");
    assert.equal(s.sample(7, 1_000)?.status, "DWELLING");
  });

  it("keeps every non-position field canonical", () => {
    const s = store();
    s.ingest([train({ progress: 0.2 })], 1_000, 0);
    s.ingest([train({ progress: 0.6, delaySeconds: 90, stale: true, source: "GTFS_REALTIME" })], 2_000, 0);
    const mid = s.sample(7, 500)!;
    assert.equal(mid.delaySeconds, 90);
    assert.equal(mid.stale, true);
    assert.equal(mid.source, "GTFS_REALTIME");
  });

  it("snaps instead of gliding across big jumps, reversals, new trips and stalls", () => {
    const jump = store();
    jump.ingest([train({ progress: 0 })], 1_000, 0);
    jump.ingest([train({ previousStationId: 4, nextStationId: 4, currentTrackId: null, status: "DWELLING" })], 2_000, 0);
    assert.equal(jump.sample(7, 1)?.previousStationId, 4, "three legs in one frame snaps");

    const twoLegs = store();
    twoLegs.ingest([train({ progress: 0 })], 1_000, 0);
    twoLegs.ingest([train({ previousStationId: 3, nextStationId: 3, currentTrackId: null, status: "DWELLING" })], 2_000, 0);
    assert.ok(Math.abs(twoLegs.toAxis(twoLegs.sample(7, 500)!)! - 1) < 1e-9, "two legs still glides");

    const back = store();
    back.ingest([train({ progress: 0.8 })], 1_000, 0);
    back.ingest([train({ progress: 0.2 })], 2_000, 0);
    assert.equal(back.sample(7, 100)?.progress, 0.2);

    const newTrip = store();
    newTrip.ingest([train({ progress: 0.8 })], 1_000, 0);
    newTrip.ingest([train({ direction: "INBOUND", previousStationId: 2, nextStationId: 1, progress: 0.1 })], 2_000, 0);
    assert.equal(newTrip.sample(7, 100)?.progress, 0.1);

    const stalled = store();
    stalled.ingest([train({ progress: 0.2 })], 1_000, 0);
    stalled.ingest([train({ progress: 0.6 })], 60_000, 0);
    assert.equal(stalled.sample(7, 100)?.progress, 0.6);
  });

  it("snaps everything under reduced motion", () => {
    const s = store();
    s.setReducedMotion(true);
    s.ingest([train({ progress: 0.2 })], 1_000, 0);
    s.ingest([train({ progress: 0.6 })], 2_000, 0);
    assert.equal(s.sample(7, 100)?.progress, 0.6);
  });

  it("forgets trains that leave the frame", () => {
    const s = store();
    s.ingest([train({})], 1_000, 0);
    s.ingest([], 2_000, 0);
    assert.equal(s.sample(7, 0), null);
  });
});
