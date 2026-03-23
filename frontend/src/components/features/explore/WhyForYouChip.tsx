'use client';

import { motion } from 'framer-motion';
import { Sparkle } from '@phosphor-icons/react';

interface WhyForYouChipProps {
  text: string;
}

export default function WhyForYouChip({ text }: WhyForYouChipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1.5 rounded-full bg-[var(--primary-surface)] px-3 py-1 text-xs text-[var(--primary-main)]"
    >
      <Sparkle size={12} weight="fill" />
      <span className="line-clamp-1">{text}</span>
    </motion.div>
  );
}
