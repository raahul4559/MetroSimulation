"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
      <p className="text-sm text-red-400">Something went wrong: {error.message}</p>
      <button
        onClick={reset}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500"
      >
        Try again
      </button>
    </div>
  );
}
