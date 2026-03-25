'use client';

import { motion } from 'framer-motion';
import { RocketLaunch } from '@phosphor-icons/react';

interface ComingSoonProps {
  title: string;
  description?: string;
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden">
      {/* Background gradient matching root page style */}
      <div className="absolute inset-0 z-[-1] bg-gradient-to-b from-white via-[#F2F8FD]/60 to-white dark:from-[var(--neutral-10)] dark:via-[var(--primary-surface)]/40 dark:to-[var(--neutral-10)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center gap-6 px-4 text-center"
      >
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-2xl bg-[var(--primary-surface)] p-5"
        >
          <RocketLaunch
            size={48}
            weight="duotone"
            className="text-[var(--primary-main)]"
          />
        </motion.div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--primary-main)]">
            Coming Soon
          </p>
          <h1 className="text-3xl font-bold text-[var(--neutral-100)] sm:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--neutral-60)]">
              {description}
            </p>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-2 flex items-center gap-2 rounded-full border border-[var(--primary-outer-border)] bg-[var(--primary-surface)] px-5 py-2.5"
        >
          <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary-main)]" />
          <span className="text-sm font-medium text-[var(--primary-main)]">
            Under Development
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
