import type { PlatformLayout3D, PassengerVisual3D, TrainVisual3D } from "@/domain/station3d";
import type { Passenger, TrainDirection } from "@/domain/trainsim";
import { PLATFORM_HALF_LENGTH, PLATFORM_WIDTH } from "./constants";
import { trainCarCenters } from "./trainLayout";

/** How far in from the platform edge a boarding/alighting passenger's door target sits — just
 * outside the train body (see the geometry note in `trainCarCenters`' caller, `MetroTrain3D`), so
 * they visibly stand on the platform rather than inside the train's box. */
const DOOR_EDGE_INSET = 0.3;
/** Waiting passengers stand a little further back from the edge than a boarding one at the door. */
const WAITING_EDGE_INSET = 1.3;
/** Fraction of the platform's length waiting passengers scatter across, centred on 0 — kept short of
 * the full half-length so nobody stands past the canopy's open ends. */
const WAITING_SPREAD = 0.8;

const carCenters = trainCarCenters();

/**
 * Resolves every real passenger belonging on *this* platform module into a {@link PassengerVisual3D}
 * — the passenger analogue of `selectStationTrainVisuals`. A passenger's platform/direction is
 * always derived from their real fields, never guessed or assigned by this function:
 *
 * - `BOARDING`: `currentTrainId` already names the exact train — matched directly against
 *   `trainsHere` (this platform's currently-visible trains).
 * - `WAITING`/`TRANSFER` (rendered as `WAITING`): the next station in their real `route` (found via
 *   `currentStationId`'s index) is compared against this platform's real outbound/inbound neighbor —
 *   the same "next hop decides the line" rule `PassengerBoardingHandler` uses on the backend.
 * - `ALIGHTING`: the *previous* station in their route (the one they just rode from) is compared the
 *   same way, since `currentTrainId` has already been cleared by the time a passenger is alighting.
 *
 * A passenger who doesn't resolve to this exact platform (wrong line/direction, or mid-journey on a
 * train not currently visible here) simply isn't returned — there is no fallback placement.
 */
export function resolveStationPassengers3D(
  passengers: readonly Passenger[],
  stationId: number,
  platform: PlatformLayout3D,
  trainsHere: readonly TrainVisual3D[]
): PassengerVisual3D[] {
  const visuals: PassengerVisual3D[] = [];

  for (const p of passengers) {
    if (p.status === "BOARDING" && p.currentTrainId != null) {
      const train = trainsHere.find((t) => t.trainId === p.currentTrainId);
      // Only ever a boarding target while the doors are actually open — a train mid-approach or
      // already departing never produces a boarding visual, so nobody walks toward a closed door.
      if (!train || train.phase !== "BOARDING") continue;
      visuals.push(doorVisual(p.id, "BOARDING", train.direction));
      continue;
    }

    if ((p.status === "WAITING" || p.status === "TRANSFER") && p.currentStationId === stationId) {
      const direction = matchDirection(p, stationId, platform, +1);
      if (!direction) continue;
      visuals.push(waitingVisual(p.id, direction));
      continue;
    }

    if (p.status === "ALIGHTING" && p.currentStationId === stationId) {
      const direction = matchDirection(p, stationId, platform, -1);
      if (!direction) continue;
      // Alighting only happens paired with that same train sitting here with its doors open —
      // `trainsHere` always reflects the live simulation state, so this is never assumed.
      const trainOpenThisWay = trainsHere.some((t) => t.direction === direction && t.phase === "BOARDING");
      if (!trainOpenThisWay) continue;
      visuals.push(doorVisual(p.id, "ALIGHTING", direction));
    }
  }

  return visuals;
}

/** Compares the passenger's route neighbor (`offset` stations from their current position — +1 for
 * "where they're headed next" while waiting, -1 for "where they just came from" while alighting)
 * against this platform's real outbound/inbound neighbor ids. Returns the matching direction, or
 * `null` if this platform isn't the one their journey actually uses. */
function matchDirection(
  p: Passenger,
  stationId: number,
  platform: PlatformLayout3D,
  offset: 1 | -1
): TrainDirection | null {
  const idx = p.route.indexOf(stationId);
  const neighborIdx = idx + offset;
  if (idx < 0 || neighborIdx < 0 || neighborIdx >= p.route.length) return null;
  const neighborStationId = p.route[neighborIdx];
  if (neighborStationId === platform.outboundNeighborId) return "OUTBOUND";
  if (neighborStationId === platform.inboundNeighborId) return "INBOUND";
  return null;
}

function waitingVisual(passengerId: number, direction: TrainDirection): PassengerVisual3D {
  const sign = direction === "OUTBOUND" ? 1 : -1;
  const targetX = sign * (PLATFORM_WIDTH / 2 - WAITING_EDGE_INSET);
  const targetZ = scatterZ(passengerId);
  return { passengerId, phase: "WAITING", direction, targetX, targetZ };
}

function doorVisual(passengerId: number, phase: "BOARDING" | "ALIGHTING", direction: TrainDirection): PassengerVisual3D {
  const sign = direction === "OUTBOUND" ? 1 : -1;
  const targetX = sign * (PLATFORM_WIDTH / 2 - DOOR_EDGE_INSET);
  const targetZ = carCenters[passengerId % carCenters.length] ?? 0;
  return { passengerId, phase, direction, targetX, targetZ };
}

/** Deterministic pseudo-random spot along the platform's waiting zone, seeded by passenger id so a
 * given passenger doesn't jitter to a new spot every time this recomputes (each simulation tick). */
function scatterZ(passengerId: number): number {
  const t = fract(Math.sin(passengerId * 12.9898) * 43758.5453);
  return (t - 0.5) * 2 * PLATFORM_HALF_LENGTH * WAITING_SPREAD;
}

function fract(x: number): number {
  return x - Math.floor(x);
}
