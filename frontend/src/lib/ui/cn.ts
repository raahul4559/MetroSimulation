/**
 * Conditional className joiner.
 *
 * Deliberately not `clsx`/`tailwind-merge`: this codebase keeps variant class sets disjoint
 * (a variant never restates a base utility), so last-wins conflict resolution is never needed
 * and the dependency would buy nothing. If you find yourself wanting a merge, that is a signal
 * the variant is overlapping its base — fix the variant instead.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
