import type { PlatformLayout3D, TrainPhase3D } from "@/domain/station3d";
import type { TrainDirection } from "@/domain/trainsim";
import {
  APPROACH_LENGTH,
  DEPART_LENGTH,
  MODULE_SPACING,
  PLATFORM_HALF_LENGTH,
  TRACK_OFFSET,
} from "./constants";

export interface TrainPose3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Rotation around Y (radians) the train model should face — the model is authored nose-first
   * along +Z, so this is 0 for an outbound-direction train and PI for inbound. */
  readonly facing: number;
}

/**
 * A train's exact scene position for one frame, given its resolved phase/localProgress (see
 * `trainVisual.ts`) — the only place track {@code progress}/{@code status} become 3D coordinates.
 * Pure and continuous: the approach curve (APPROACHING, then ARRIVING) ends exactly at the stopping
 * point (z = 0) where STOPPED/BOARDING stand, and DEPARTING starts from it — so a train whose
 * progress moves smoothly (it does: `MetroTrain3D` feeds this the shared motion store's sample every
 * display frame) moves smoothly here too, with no per-renderer smoothing of its own.
 */
export function trainPose3D(
  platform: Pick<PlatformLayout3D, "moduleIndex">,
  direction: TrainDirection,
  phase: TrainPhase3D,
  localProgress: number
): TrainPose3D {
  const moduleX = platform.moduleIndex * MODULE_SPACING;
  const forwardSign = direction === "OUTBOUND" ? 1 : -1;
  const trackX = moduleX + forwardSign * TRACK_OFFSET;

  let z: number;
  switch (phase) {
    case "APPROACHING":
    case "ARRIVING": {
      const farZ = forwardSign * -(PLATFORM_HALF_LENGTH + APPROACH_LENGTH);
      z = lerp(farZ, 0, localProgress);
      break;
    }
    case "STOPPED":
    case "BOARDING":
      z = 0;
      break;
    case "DEPARTING": {
      const farZ = forwardSign * (PLATFORM_HALF_LENGTH + DEPART_LENGTH);
      z = lerp(0, farZ, localProgress);
      break;
    }
  }

  return {
    x: trackX,
    y: 0,
    z,
    facing: forwardSign > 0 ? 0 : Math.PI,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
