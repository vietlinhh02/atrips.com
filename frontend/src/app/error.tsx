"use client";

import { motion } from "framer-motion";
import { Warning, ArrowClockwise, House } from "@phosphor-icons/react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center
        bg-[var(--neutral-10)] px-4"
    >
      <motion.div
        className="flex max-w-lg flex-col items-center text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            delay: 0.1,
          }}
          className="mb-6 flex h-20 w-20 items-center justify-center
            rounded-full bg-[color:var(--destructive)]/10"
        >
          <Warning
            size={40}
            weight="duotone"
            className="text-[color:var(--destructive)]"
          />
        </motion.div>

        <motion.h1
          className="text-2xl font-semibold text-[var(--neutral-100)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Something went wrong
        </motion.h1>

        <motion.p
          className="mt-2 text-sm text-[var(--neutral-60)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          An unexpected error occurred. You can try again or
          return to the home page.
        </motion.p>

        <motion.div
          className="mt-4 w-full max-w-sm rounded-lg border
            border-[var(--neutral-30)] bg-[var(--neutral-20)] px-4 py-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <p
            className="break-all font-mono text-xs
              text-[var(--neutral-60)]"
          >
            {error.message || "Unknown error"}
          </p>
        </motion.div>

        <motion.div
          className="mt-8 flex gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <button
            onClick={reset}
            className="inline-flex cursor-pointer items-center gap-2
              rounded-lg bg-[var(--primary-main)] px-5 py-2.5 text-sm
              font-medium text-white transition-colors
              hover:bg-[var(--primary-hover)]"
          >
            <ArrowClockwise size={16} weight="bold" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg
              border border-[var(--neutral-40)]
              bg-[var(--neutral-10)] px-5 py-2.5 text-sm font-medium
              text-[var(--neutral-100)] transition-colors
              hover:bg-[var(--neutral-20)]"
          >
            <House size={16} weight="bold" />
            Go Home
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
