"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NAV_ITEMS, isActiveRoute } from "@/lib/nav/routes";
import { cn } from "@/lib/ui/cn";
import { IconButton } from "@/components/ui/IconButton";
import { NavConnectionBadge } from "./NavConnectionBadge";
import { SearchCommand } from "./SearchCommand";
import { SettingsMenu } from "./SettingsMenu";

/**
 * The application's one header.
 *
 * Each of the three original routes hand-rolled its own header with its own back-link treatment —
 * a text link on one, a bordered button on another, a blue link on a third — and `/analytics` had
 * no inbound link at all. One navbar in the root layout replaces all of that.
 *
 * Kept to 56px: the map is the primary visual element and every pixel of chrome is taken from it.
 */
export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-[var(--z-dock)] shrink-0 border-b border-divider bg-canvas/85 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-md py-1 pr-1 transition-opacity hover:opacity-80"
        >
          <Wordmark />
        </Link>

        <nav aria-label="Primary" className="ml-2 hidden items-center gap-0.5 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[13px] font-medium",
                  "transition-colors duration-(--duration-fast) ease-(--ease-out)",
                  active ? "bg-white/8 text-content" : "text-muted hover:bg-white/5 hover:text-secondary",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchCommand />
          <div className="hidden sm:block">
            <NavConnectionBadge />
          </div>
          <SettingsMenu />
          <div className="md:hidden">
            <IconButton
              label={mobileOpen ? "Close menu" : "Open menu"}
              icon={mobileOpen ? <X size={18} /> : <Menu size={18} />}
              size="sm"
              onClick={() => setMobileOpen((v) => !v)}
              tooltipSide="bottom"
            />
          </div>
        </div>
      </div>

      {mobileOpen && (
        <nav
          aria-label="Primary"
          className="border-t border-divider px-3 pb-3 pt-2 md:hidden motion-safe:animate-[panel-in_var(--duration-fast)_var(--ease-out)]"
        >
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2.5 py-2.5 text-sm font-medium",
                      active ? "bg-white/8 text-content" : "text-secondary hover:bg-white/5",
                    )}
                  >
                    <Icon size={16} aria-hidden className="shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 border-t border-divider px-2.5 pt-3 sm:hidden">
            <NavConnectionBadge />
          </div>
        </nav>
      )}
    </header>
  );
}

/**
 * The mark: three stacked bars in the three line colours, read as a schematic network. Uses the
 * brand hexes rather than the lifted -vivid tier — at this size they sit on their own, not against
 * text, so identity matters more than contrast.
 */
function Wordmark() {
  return (
    <>
      <span aria-hidden className="flex flex-col gap-[3px]">
        <span className="block h-[3px] w-4 rounded-full bg-line-purple" />
        <span className="block h-[3px] w-4 rounded-full bg-line-green" />
        <span className="block h-[3px] w-4 rounded-full bg-line-yellow" />
      </span>
      <span className="text-sm font-semibold tracking-tight text-content">
        Namma Metro
        <span className="ml-1.5 hidden text-[11px] font-normal text-muted lg:inline">
          Digital Twin
        </span>
      </span>
    </>
  );
}
