import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { StationLayout3D } from "@/domain/station3d";
import type { RealtimeAlert } from "@/domain/realtime";
import { deriveAlertAnnouncements } from "./announcementService";

const station: StationLayout3D = {
  stationId: 5,
  code: "MAJESTIC",
  name: "Majestic",
  stationType: "INTERCHANGE",
  orientationRadians: 0,
  platforms: [
    { lineCode: "PURPLE", lineName: "Purple Line", colorHex: "#800080", moduleIndex: 0, platformNumber: 1, outboundNeighborId: 6, inboundNeighborId: 4 },
    { lineCode: "GREEN", lineName: "Green Line", colorHex: "#008000", moduleIndex: 1, platformNumber: 3, outboundNeighborId: 7, inboundNeighborId: 8 },
  ],
};

function alert(overrides: Partial<RealtimeAlert>): RealtimeAlert {
  return {
    id: "a1", source: "GTFS_REALTIME", cause: null, effect: null, severity: "WARNING",
    headerText: "Purple Line services are delayed", descriptionText: null, activeFrom: null, activeUntil: null,
    lineCodes: [], stationIds: [], ...overrides,
  };
}

describe("deriveAlertAnnouncements", () => {
  it("announces an alert for this station or one of its lines once, on first appearance", () => {
    const alerts = [alert({ id: "s", stationIds: [5] }), alert({ id: "l", lineCodes: ["GREEN"] })];
    const first = deriveAlertAnnouncements(station, alerts, new Set());
    assert.deepEqual(first.events.map((e) => e.type), ["SERVICE_DISRUPTION", "SERVICE_DISRUPTION"]);
    assert.equal(first.events[1]!.data.lineName, "Green Line");

    const again = deriveAlertAnnouncements(station, alerts, first.activeIds);
    assert.equal(again.events.length, 0);
  });

  it("ignores alerts for other stations or lines", () => {
    const alerts = [alert({ id: "x", stationIds: [99], lineCodes: ["PURPLE"] }), alert({ id: "y", lineCodes: ["YELLOW"] })];
    assert.equal(deriveAlertAnnouncements(station, alerts, new Set()).events.length, 0);
  });

  it("raises EMERGENCY only for severe accident/police/medical alerts", () => {
    const severe = alert({ id: "e", stationIds: [5], severity: "SEVERE", cause: "MEDICAL_EMERGENCY" });
    const severeOther = alert({ id: "m", stationIds: [5], severity: "SEVERE", cause: "MAINTENANCE" });
    const types = deriveAlertAnnouncements(station, [severe, severeOther], new Set()).events.map((e) => e.type);
    assert.deepEqual(types, ["EMERGENCY", "SERVICE_DISRUPTION"]);
  });
});
