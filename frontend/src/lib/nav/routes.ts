import type { LucideIcon } from "lucide-react";
import { Activity, Building2, ChartNoAxesColumn, Map } from "lucide-react";

export interface NavItem {
  /** Typed against Next's generated route union, so a mistyped path fails the build. */
  readonly href: "/" | "/operations" | "/stations" | "/analytics";
  readonly label: string;
  /** Shown on small screens where the label is hidden. */
  readonly shortLabel: string;
  readonly icon: LucideIcon;
}

/**
 * The application's top-level destinations, in the order they appear.
 *
 * `/analytics` was previously unreachable — nothing in the app linked to it and you could only get
 * there by typing the URL. Listing the routes in one place is what fixes that, and keeps the three
 * pages from each inventing their own header and back-link again.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Network", shortLabel: "Network", icon: Map },
  { href: "/operations", label: "Live Operations", shortLabel: "Ops", icon: Activity },
  { href: "/stations", label: "Stations", shortLabel: "Stations", icon: Building2 },
  { href: "/analytics", label: "Analytics", shortLabel: "Analytics", icon: ChartNoAxesColumn },
];

/** Marks the active item. `/` must match exactly, or it would light up on every route. */
export function isActiveRoute(pathname: string, href: NavItem["href"]): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
