export type BlockState = "FREE" | "RESERVED" | "OCCUPIED";
export type SignalAspect = "RED" | "YELLOW" | "GREEN";

/** Mirrors the backend's `SignalResponse` — one block signal, computed fresh every tick. */
export interface Signal {
  readonly id: string;
  readonly trackId: number;
  readonly protectedSectionId: number;
  readonly blockState: BlockState;
  readonly aspect: SignalAspect;
  readonly controllingTrainId: number | null;
}
