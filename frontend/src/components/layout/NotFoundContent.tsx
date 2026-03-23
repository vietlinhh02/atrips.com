"use client";

import { motion } from "framer-motion";
import { MapPin } from "@phosphor-icons/react";

export default function NotFoundContent() {
  return (
    <motion.div
      className="flex flex-col items-center text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 15,
          delay: 0.1,
        }}
        className="mb-6 flex h-20 w-20 items-center justify-center
          rounded-full bg-[var(--primary-surface)]"
      >
        <MapPin
          size={40}
          weight="duotone"
          className="text-[var(--primary-main)]"
        />
      </motion.div>

      <motion.p
        className="bg-gradient-to-r from-[var(--primary-main)]
          to-[var(--primary-hover)] bg-clip-text text-8xl font-bold
          tracking-tight text-transparent"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        404
      </motion.p>

      <motion.h1
        className="mt-4 text-2xl font-semibold text-[var(--neutral-100)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Page not found
      </motion.h1>

      <motion.p
        className="mt-2 max-w-md text-sm text-[var(--neutral-60)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        The page you&apos;re looking for doesn&apos;t exist
        or has been moved.
      </motion.p>
    </motion.div>
  );
}
