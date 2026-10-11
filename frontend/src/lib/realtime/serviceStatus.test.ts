import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ServiceStatus } from "@/domain/realtime";
import { lastServiceText, nextServiceText, unknownExplanation } from "./serviceStatusDisplay";
import { formatIstHourMinute, formatIstTimeOfDay, istDateKey, recordServerTime, serverNowMs } from "./serverClock";

function service(overrides: Partial<ServiceStatus>): ServiceStatus {
  return {
    evaluatedAt: "", evaluatedAtIst: "", serviceDay: "2026-10-12", dayType: "WEEKDAY", state: "OPERATING",
    reason: "", started: true, operating: true, ended: false, firstDepartureAt: null, firstDepartureAtIst: null,
    lastDepartureAt: null, lastDepartureAtIst: null, nextServiceAt: null, nextServiceAtIst: null,
    nextServiceLineCode: null, scheduleExceptions: [], timetableConfigured: true, timetableSource: "",
    lines: [], disruptionAlertIds: [], ...overrides,
  };
}

// 23:58 IST on Monday 12 Oct 2026 is 18:28 UTC.
const NIGHT = Date.parse("2026-10-12T18:28:00Z");

describe("IST formatting", () => {
  it("is Asia/Kolkata whatever the process timezone is", () => {
    // Run this suite with e.g. TZ=America/New_York — the answers must not change.
    assert.equal(formatIstTimeOfDay(NIGHT), "23:58:00");
    assert.equal(formatIstHourMinute(Date.parse("2026-10-12T23:30:00Z")), "05:00");
    assert.equal(istDateKey(Date.parse("2026-10-12T18:30:00Z")), "2026-10-13"); // midnight IST
  });

  it("follows the server clock, not the local one", () => {
    const server = Date.now() + 7 * 60_000; // a local clock seven minutes slow
    recordServerTime(server);
    assert.ok(Math.abs(serverNowMs() - server) < 1_000);
  });
});

describe("service status display", () => {
  it("shows the next scheduled service only when service isn't running and the timetable gave one", () => {
    const ended = service({ state: "ENDED", operating: false, ended: true, nextServiceAt: "2026-10-12T23:30:00Z" });
    assert.equal(nextServiceText(ended, NIGHT), "05:00 IST");
    assert.equal(nextServiceText({ ...ended, nextServiceAt: null }, NIGHT), null);
    assert.equal(nextServiceText({ ...ended, state: "OPERATING" }, NIGHT), null);
    assert.equal(nextServiceText({ ...ended, state: "UNKNOWN" }, NIGHT), null);
  });

  it("dates a next service that is further away than tomorrow", () => {
    const closed = service({ state: "SUSPENDED", nextServiceAt: "2026-10-15T23:30:00Z" }); // Fri 16 Oct 05:00 IST
    assert.match(nextServiceText(closed, NIGHT)!, /16 Oct · 05:00 IST$/);
  });

  it("explains unknown status as missing hours, not an outage", () => {
    assert.equal(unknownExplanation(service({ state: "UNKNOWN", timetableConfigured: false })), "Operating hours not configured");
    assert.equal(unknownExplanation(service({ state: "OPERATING" })), null);
    assert.equal(lastServiceText(service({ state: "UNKNOWN", lastDepartureAt: "2026-10-12T17:30:00Z" })), null);
    assert.equal(lastServiceText(service({ state: "OPERATING", lastDepartureAt: "2026-10-12T17:30:00Z" })), "23:00 IST");
  });
});
