/**
 * Formatting for the simulation clock and the operator's wall clock.
 *
 * Lives here rather than inside the controls component because the dock, the operations header and
 * the 3D station overlay all render the same simulated time and must agree on its shape.
 */

/** The simulated time of day, HH:MM:SS. The instant is a wall-clock-free simulation timestamp, so
 * it is read in UTC deliberately — rendering it in the viewer's zone would shift the timetable. */
export function simulatedTimeOfDay(isoInstant: string): string {
  const date = new Date(isoInstant);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toISOString().slice(11, 19);
}

/** The operator's real local date and time, for grounding the simulated clock against. */
export function formatRealDateTime(date: Date): string {
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
}
