import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:p-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="min-h-[320px] flex-1 rounded-lg" />
    </main>
  );
}
