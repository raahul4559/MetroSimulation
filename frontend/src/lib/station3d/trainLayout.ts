import { TRAIN_CARS, TRAIN_CAR_GAP, TRAIN_CAR_LENGTH, TRAIN_LENGTH } from "./constants";

/** Local-Z centre of each car in a stationary train (group origin at the train's midpoint) — the
 * one place this layout is computed, shared by `MetroTrain3D` (car meshes) and
 * `passengerVisual.ts` (door target positions), so a passenger's boarding point always lines up
 * with the actual car/door geometry instead of an independently-guessed offset. */
export function trainCarCenters(): readonly number[] {
  return Array.from(
    { length: TRAIN_CARS },
    (_, i) => -TRAIN_LENGTH / 2 + TRAIN_CAR_LENGTH / 2 + i * (TRAIN_CAR_LENGTH + TRAIN_CAR_GAP)
  );
}
