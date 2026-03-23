'use client';

export default function ProfileSkeleton() {
  return (
    <div className="w-full">
      {/* Cover Photo skeleton */}
      <div className="h-48 bg-[var(--neutral-20)] animate-pulse" />

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Avatar + Info row */}
        <div className="relative -mt-[72px] mb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="h-36 w-36 rounded-full bg-[var(--neutral-30)] animate-pulse ring-2 ring-[var(--neutral-10)] shrink-0" />
            <div className="flex-1 pb-1 space-y-2">
              <div className="h-7 w-48 rounded bg-[var(--neutral-20)] animate-pulse" />
              <div className="h-4 w-24 rounded bg-[var(--neutral-20)] animate-pulse" />
              <div className="h-4 w-64 rounded bg-[var(--neutral-20)] animate-pulse" />
              <div className="h-4 w-32 rounded bg-[var(--neutral-20)] animate-pulse" />
            </div>
            <div className="flex gap-2 sm:pb-1">
              <div className="h-9 w-28 rounded-lg bg-[var(--neutral-20)] animate-pulse" />
            </div>
          </div>
        </div>

        {/* Tab bar skeleton */}
        <div className="border-b border-[var(--neutral-30)] mb-6">
          <div className="flex gap-6 pb-3">
            <div className="h-4 w-20 rounded bg-[var(--neutral-20)] animate-pulse" />
            <div className="h-4 w-24 rounded bg-[var(--neutral-20)] animate-pulse" />
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-56 rounded-[10px] bg-[var(--neutral-20)] animate-pulse" />
              <div className="pt-3 space-y-2">
                <div className="h-5 w-3/4 rounded bg-[var(--neutral-20)] animate-pulse" />
                <div className="h-4 w-1/2 rounded bg-[var(--neutral-20)] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
