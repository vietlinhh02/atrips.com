'use client';

import { motion } from 'framer-motion';

export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1]
      }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
}
