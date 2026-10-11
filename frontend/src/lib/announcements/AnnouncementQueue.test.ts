import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ANNOUNCEMENT_PRIORITY, type AnnouncementEvent, type AnnouncementType } from "@/domain/announcement";
import type { PreparedUtterance } from "@/lib/audio/VoiceProvider";
import { AnnouncementQueue, readingTimeMs, type QueueCaption } from "./AnnouncementQueue";

let nextId = 0;
function event(type: AnnouncementType, trainId: number | null = 1): AnnouncementEvent {
  return {
    id: `e${++nextId}`,
    type,
    priority: ANNOUNCEMENT_PRIORITY[type],
    trainId,
    data: {
      stationCode: "MAJESTIC", stationName: "Majestic", platform: 1, lineCode: "PURPLE", lineName: "Purple Line",
      destinationStationCode: "WHITEFIELD", destinationStationName: "Whitefield", nextStationCode: null,
      nextStationName: null, trainNumber: "P01", direction: "OUTBOUND", delaySeconds: 0, transferLines: null,
      disruptionDescription: null, disruptionType: null,
    },
  };
}

/** A queue whose audio only finishes when the test says so. */
function harness(opts: { delivery?: PreparedUtterance["delivery"]; failPlay?: boolean } = {}) {
  const captions: (QueueCaption | null)[] = [];
  const sleeps: number[] = [];
  const finishers: (() => void)[] = [];
  let interrupts = 0;
  let clock = 0;
  const queue = new AnnouncementQueue({
    prepare: async () => ({
      delivery: opts.delivery ?? "SYNTHESIZED",
      provenance: null,
      play: () =>
        opts.failPlay
          ? Promise.reject(new Error("decode failed"))
          : new Promise<void>((resolve) => finishers.push(resolve)),
    }),
    textFor: (e) => e.type,
    onCaption: (c) => captions.push(c),
    isEnabled: () => true,
    interrupt: () => {
      interrupts += 1;
      finishers.splice(0).forEach((f) => f());
    },
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return {
    queue,
    captions,
    sleeps,
    spoken: () => captions.filter((c): c is QueueCaption => c != null).map((c) => c.event.type),
    finishCurrent: async () => {
      await flush();
      finishers.shift()?.();
      await flush();
    },
    interrupts: () => interrupts,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("AnnouncementQueue", () => {
  it("plays waiting jobs strictly by priority, FIFO within a tier", async () => {
    const h = harness();
    h.queue.enqueue(event("BOARDING", 1), ["en"]);
    await flush();
    h.queue.enqueue(event("TRANSFER", 2), ["en"]);
    h.queue.enqueue(event("TRAIN_APPROACHING", 3), ["en"]);
    h.queue.enqueue(event("SAFETY", 4), ["en"]);
    assert.deepEqual(h.queue.pending().map((e) => e.type), ["SAFETY", "TRAIN_APPROACHING", "TRANSFER"]);
  });

  it("never voices chime-only events", async () => {
    const h = harness();
    for (const t of ["TRAIN_ARRIVING", "TRAIN_AT_PLATFORM", "DOORS_OPENING", "DOORS_CLOSING"] as const) {
      h.queue.enqueue(event(t), ["en"]);
    }
    await flush();
    assert.deepEqual(h.spoken(), []);
  });

  it("lets EMERGENCY cut off a lower-priority announcement mid-sentence", async () => {
    const h = harness();
    h.queue.enqueue(event("TRAIN_DEPARTING"), ["en", "hi"]);
    await flush();
    h.queue.enqueue(event("EMERGENCY", null), ["en"]);
    await flush();
    assert.equal(h.interrupts(), 1);
    await flush();
    // The departing job's Hindi pass never plays; the emergency goes next.
    assert.deepEqual(h.spoken(), ["TRAIN_DEPARTING", "EMERGENCY"]);
  });

  it("drops a train's earlier-stage announcement once a later stage arrives", async () => {
    const h = harness();
    h.queue.enqueue(event("SERVICE_DISRUPTION", null), ["en"]); // occupies the PA
    await flush();
    h.queue.enqueue(event("TRAIN_APPROACHING", 7), ["en"]);
    h.queue.enqueue(event("TRAIN_DEPARTING", 7), ["en"]);
    assert.deepEqual(h.queue.pending().map((e) => e.type), ["TRAIN_DEPARTING"]);
  });

  it("ignores a duplicate of something already queued or playing", async () => {
    const h = harness();
    h.queue.enqueue(event("TRAIN_APPROACHING", 3), ["en"]);
    await flush();
    h.queue.enqueue(event("TRAIN_APPROACHING", 3), ["en"]);
    assert.equal(h.queue.pending().length, 0);
  });

  it("doesn't repeat the same sentence within the cooldown, even for another train", async () => {
    const h = harness();
    h.queue.enqueue(event("SAFETY", 1), ["en"]);
    await h.finishCurrent();
    h.queue.enqueue(event("SAFETY", 2), ["en"]);
    await flush();
    assert.deepEqual(h.spoken(), ["SAFETY"]);
    h.advance(16_000);
    h.queue.enqueue(event("SAFETY", 3), ["en"]);
    await flush();
    assert.deepEqual(h.spoken(), ["SAFETY", "SAFETY"]);
  });

  it("skips train announcements that went stale while waiting", async () => {
    const h = harness();
    h.queue.enqueue(event("SERVICE_DISRUPTION", null), ["en"]);
    await flush();
    h.queue.enqueue(event("TRAIN_APPROACHING", 9), ["en"]);
    h.advance(30_000);
    await h.finishCurrent();
    assert.deepEqual(h.spoken(), ["SERVICE_DISRUPTION"]);
  });

  it("holds a text-only caption for a reading interval when there's no audio", async () => {
    const h = harness({ delivery: "TEXT_ONLY" });
    h.queue.enqueue(event("TRAIN_APPROACHING"), ["en"]);
    await flush();
    const first = h.captions.find((c) => c != null);
    assert.equal(first?.delivery, "TEXT_ONLY");
    assert.ok(h.sleeps.includes(readingTimeMs("TRAIN_APPROACHING")));
  });

  it("falls back to text when playback itself fails", async () => {
    const h = harness({ failPlay: true });
    h.queue.enqueue(event("TRAIN_APPROACHING"), ["en"]);
    await flush();
    await flush();
    const deliveries = h.captions.filter((c) => c != null).map((c) => c!.delivery);
    assert.deepEqual(deliveries, ["SYNTHESIZED", "TEXT_ONLY"]);
  });
});
