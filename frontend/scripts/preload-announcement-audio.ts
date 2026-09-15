/**
 * Warms the backend's announcement-audio cache (`AnnouncementAudioService`) so real 3D-station
 * announcements never pay a live Google-Cloud-TTS-plus-ffmpeg round trip for the common phrases —
 * "never generate a new AI voice recording every time a train arrives," made concrete ahead of
 * time rather than left entirely to lazy synthesize-on-first-use.
 *
 * Reuses the SAME text-building code the running app uses (`buildAnnouncementText`, which itself
 * calls `resolveAnnouncementData`/`resolveStationSpeechName`) — this script builds representative
 * `AnnouncementData`, it never duplicates a single word of template wording.
 *
 * Coverage (documented, not silently partial — see the spec's "no silent caps" principle): one
 * representative OUTBOUND announcement per station per line it serves, platform 1, for every
 * spoken (non-`LOW`-priority) `AnnouncementType`, in all three languages — plus all six
 * `SERVICE_DISRUPTION` disruption types, which don't vary by station (see `templates/*.ts`: none
 * of them reference `stationName`). NOT pre-warmed: INBOUND-direction phrasing, platform numbers
 * other than 1, TRANSFER at non-interchange stations, and arbitrary `DELAY` minute counts beyond
 * the one representative value used here — each of those synthesizes once on its first real
 * occurrence and self-caches from then on (see `AnnouncementAudioService`'s cache-on-miss design),
 * so under-coverage here costs one live latency, never a correctness gap.
 *
 * Requires the backend running locally (reads the real network from `GET /api/metro/network`).
 * Without `GOOGLE_CLOUD_TTS_API_KEY` configured there, every request comes back `204` and this
 * script just reports everything as "unavailable" — harmless, not an error.
 *
 * Usage: npm run preload-audio
 */
import { buildAnnouncementText } from "@/lib/announcements/templates";
import type { AnnouncementData, AnnouncementType, LanguageCode } from "@/domain/announcement";
import type { DisruptionType } from "@/domain/trainsim";

const METRO_API_BASE = process.env.METRO_API_BASE_URL ?? "http://localhost:8080/api/metro";
const ANNOUNCEMENT_API_BASE = process.env.ANNOUNCEMENT_API_BASE_URL ?? "http://localhost:8080/api/announcements";
const CONCURRENCY = 4;

const LANGUAGES: readonly LanguageCode[] = ["en", "hi", "kn"];

/** Every `AnnouncementType` `AnnouncementQueue` will actually speak — `LOW`-priority types
 * (`TRAIN_ARRIVING`, `TRAIN_AT_PLATFORM`, `DOORS_OPENING`, `DOORS_CLOSING`) never reach a
 * `VoiceProvider` at all (chime-only by design), so warming their audio would be pure waste. */
const STATION_ANNOUNCEMENT_TYPES: readonly AnnouncementType[] = [
  "TRAIN_APPROACHING",
  "SAFETY",
  "TRAIN_DEPARTING",
  "NEXT_STATION",
  "BOARDING",
  "DELAY",
  "TRANSFER",
];

const DISRUPTION_TYPES: readonly DisruptionType[] = [
  "TRAIN_FAILURE",
  "SIGNAL_FAILURE",
  "STATION_CONGESTION",
  "TRACK_BLOCKAGE",
  "EXTENDED_DWELL",
  "CUSTOM_DELAY",
];

interface NetworkStation {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly lines: readonly string[];
}

interface NetworkLine {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly stations: readonly NetworkStation[];
}

interface NetworkResponse {
  readonly stations: readonly NetworkStation[];
  readonly lines: readonly NetworkLine[];
}

type SynthesisOutcome = "warmed" | "unavailable" | "error";

async function fetchNetwork(): Promise<NetworkResponse> {
  const res = await fetch(`${METRO_API_BASE}/network`);
  if (!res.ok) {
    throw new Error(`Failed to fetch metro network (HTTP ${res.status}) — is the backend running on ${METRO_API_BASE}?`);
  }
  return (await res.json()) as NetworkResponse;
}

async function synthesize(text: string, language: LanguageCode): Promise<SynthesisOutcome> {
  try {
    const res = await fetch(`${ANNOUNCEMENT_API_BASE}/audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });
    if (res.status === 204) return "unavailable";
    if (!res.ok) return "error";
    await res.arrayBuffer(); // drain the body — we only need it to now exist in the backend's cache
    return "warmed";
  } catch {
    return "error";
  }
}

function stationAnnouncementData(station: NetworkStation, line: NetworkLine): AnnouncementData | null {
  const index = line.stations.findIndex((s) => s.id === station.id);
  if (index === -1) return null;

  const destination = line.stations[line.stations.length - 1]!;
  const next = index < line.stations.length - 1 ? line.stations[index + 1]! : null;
  const otherLines = station.lines.filter((code) => code !== line.code);

  return {
    stationCode: station.code,
    stationName: station.name,
    platform: 1,
    lineCode: line.code,
    lineName: line.name,
    destinationStationCode: destination.code,
    destinationStationName: destination.name,
    nextStationCode: next?.code ?? null,
    nextStationName: next?.name ?? null,
    trainNumber: `${line.code.slice(0, 1)}01`,
    direction: "OUTBOUND",
    delaySeconds: 300, // one representative "we regret the ~5 minute delay" phrase
    transferLines: otherLines.length > 0 ? otherLines : null,
    disruptionDescription: null,
    disruptionType: null,
  };
}

function disruptionAnnouncementData(type: DisruptionType): AnnouncementData {
  return {
    stationCode: "",
    stationName: "",
    platform: null,
    lineCode: "",
    lineName: "",
    destinationStationCode: null,
    destinationStationName: "",
    nextStationCode: null,
    nextStationName: null,
    trainNumber: "",
    direction: "OUTBOUND",
    delaySeconds: 0,
    transferLines: null,
    disruptionDescription: null,
    disruptionType: type,
  };
}

function buildJobs(network: NetworkResponse): Array<{ text: string; language: LanguageCode }> {
  const jobs: Array<{ text: string; language: LanguageCode }> = [];

  for (const line of network.lines) {
    for (const station of line.stations) {
      const data = stationAnnouncementData(station, line);
      if (!data) continue;
      for (const type of STATION_ANNOUNCEMENT_TYPES) {
        if (type === "TRANSFER" && !data.transferLines) continue;
        for (const language of LANGUAGES) {
          jobs.push({ text: buildAnnouncementText(type, data, language), language });
        }
      }
    }
  }

  for (const type of DISRUPTION_TYPES) {
    const data = disruptionAnnouncementData(type);
    for (const language of LANGUAGES) {
      jobs.push({ text: buildAnnouncementText("SERVICE_DISRUPTION", data, language), language });
    }
  }

  return jobs;
}

async function runPool(jobs: ReadonlyArray<{ text: string; language: LanguageCode }>): Promise<Record<SynthesisOutcome, number>> {
  const counts: Record<SynthesisOutcome, number> = { warmed: 0, unavailable: 0, error: 0 };
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < jobs.length) {
      const job = jobs[cursor]!;
      cursor += 1;
      const outcome = await synthesize(job.text, job.language);
      counts[outcome] += 1;
      if (cursor % 25 === 0 || cursor === jobs.length) {
        console.log(
          `  ${cursor}/${jobs.length} (${counts.warmed} synthesized/cached, ${counts.unavailable} unavailable, ${counts.error} errors)`
        );
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return counts;
}

async function main(): Promise<void> {
  console.log(`Fetching metro network from ${METRO_API_BASE}...`);
  const network = await fetchNetwork();

  const jobs = buildJobs(network);
  console.log(`Warming ${jobs.length} announcement clips against ${ANNOUNCEMENT_API_BASE}...`);

  const counts = await runPool(jobs);

  console.log(
    `\nDone. ${counts.warmed} clips synthesized or already cached, ${counts.unavailable} unavailable ` +
      `(check GOOGLE_CLOUD_TTS_API_KEY on the backend), ${counts.error} errors.`
  );
  console.log(
    "Not pre-warmed by design: INBOUND-direction phrasing, non-platform-1 numbers, and arbitrary DELAY " +
      "minute counts — see this file's header comment for why that's fine."
  );

  if (counts.error > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
