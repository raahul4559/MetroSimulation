"use client";

import { Volume2 } from "lucide-react";
import { LANGUAGE_LABELS } from "@/domain/announcement";
import type { AnnouncementCaption } from "@/lib/announcements/AnnouncementService";

/**
 * The live caption for whatever the PA is saying right now.
 *
 * Mirrors the audio exactly, including which of the three languages is currently being spoken —
 * `AnnouncementService` clears it itself the moment playback stops, so this never lingers on a
 * stale line. `aria-live="polite"` makes it reach a screen reader too, which matters because the
 * announcement is otherwise purely audible.
 */
export function AnnouncementIndicator({ caption }: { caption: AnnouncementCaption }) {
  return (
    <div
      className="pointer-events-none flex max-w-xl items-center gap-2.5 rounded-full bg-surface/85 px-3.5 py-2 shadow-lg ring-1 ring-edge backdrop-blur-xl motion-safe:animate-[panel-in_var(--duration-base)_var(--ease-out)]"
      role="status"
      aria-live="polite"
    >
      <Volume2 size={14} className="shrink-0 text-accent" aria-hidden />
      <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-secondary">
        {LANGUAGE_LABELS[caption.language]}
      </span>
      <span className="text-xs text-content">{caption.text}</span>
    </div>
  );
}
