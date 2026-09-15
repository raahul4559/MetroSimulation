import { cn } from "@/lib/ui/cn";

/** Shimmer placeholder. Sized by the caller so it occupies the same box the real content will. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("relative overflow-hidden rounded bg-white/5", className)}
    >
      <div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/8 to-transparent"
        style={{ animation: "shimmer 1.6s var(--ease-in-out) infinite" }}
      />
    </div>
  );
}
