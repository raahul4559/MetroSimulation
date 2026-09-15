"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Surface className="max-w-md text-center" padding="lg">
        <TriangleAlert size={20} className="mx-auto text-danger" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-content">
          Something went wrong
        </h1>
        <p className="mt-2 break-words text-sm text-secondary">{error.message}</p>
        {error.digest && (
          <p className="mt-2 font-mono text-[11px] text-muted">Reference {error.digest}</p>
        )}
        <Button className="mt-5" icon={<RotateCcw size={14} />} onClick={reset}>
          Try again
        </Button>
      </Surface>
    </main>
  );
}
