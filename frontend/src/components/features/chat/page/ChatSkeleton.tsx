'use client';

export default function ChatSkeleton() {
  return (
    <div className="flex h-[calc(100%-1rem)] w-full max-w-[480px] flex-col overflow-hidden rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] shadow-[6px_6px_32px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col gap-4 p-6 pb-2 border-b border-transparent">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 bg-[var(--neutral-20)] rounded animate-pulse" />
          <div className="h-8 w-8 bg-[var(--neutral-20)] rounded-full animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-20 bg-[var(--neutral-20)] rounded-[10px] animate-pulse" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6 space-y-8 overflow-hidden">
        <div className="flex flex-col items-end gap-2 ml-auto w-full max-w-[85%]">
          <div className="flex items-center gap-2 self-end">
            <div className="h-4 w-12 bg-[var(--neutral-20)] rounded animate-pulse" />
            <div className="h-8 w-8 rounded-full bg-[var(--neutral-20)] animate-pulse" />
          </div>
          <div className="h-24 w-full rounded-[10px] bg-[var(--neutral-20)] animate-pulse" />
        </div>
        <div className="flex flex-col items-start gap-2 mr-auto w-full max-w-[85%]">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-[var(--neutral-20)] animate-pulse" />
            <div className="h-4 w-16 bg-[var(--neutral-20)] rounded animate-pulse" />
          </div>
          <div className="h-32 w-full rounded-[10px] bg-[var(--neutral-20)] animate-pulse" />
        </div>
      </div>
      <div className="p-6 pt-2">
        <div className="h-12 w-full rounded-[6px] bg-[var(--neutral-20)] animate-pulse" />
      </div>
    </div>
  );
}
