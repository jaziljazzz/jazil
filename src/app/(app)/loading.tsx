import { Skeleton } from "@/components/ui";

/** Shown instantly on every tap while the next screen loads. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-3 py-3 md:px-8 md:py-8" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[76px] rounded-[14px]" />)}
      </div>
      <Skeleton className="mt-4 h-11 rounded-lg" />
      <div className="mt-5 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3.5 py-3.5">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="size-9 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
