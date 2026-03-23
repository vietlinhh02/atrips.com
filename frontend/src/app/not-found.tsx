import Link from "next/link";
import NotFoundContent from "@/src/components/layout/NotFoundContent";

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center
        bg-[var(--neutral-10)] px-4"
    >
      <NotFoundContent />

      <div className="mt-8 flex gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg
            bg-[var(--primary-main)] px-5 py-2.5 text-sm font-medium
            text-white transition-colors hover:bg-[var(--primary-hover)]"
        >
          Go Home
        </Link>
        <Link
          href="/explore"
          className="inline-flex items-center gap-2 rounded-lg
            border border-[var(--neutral-40)] bg-[var(--neutral-10)]
            px-5 py-2.5 text-sm font-medium text-[var(--neutral-100)]
            transition-colors hover:bg-[var(--neutral-20)]"
        >
          Explore Destinations
        </Link>
      </div>
    </div>
  );
}
