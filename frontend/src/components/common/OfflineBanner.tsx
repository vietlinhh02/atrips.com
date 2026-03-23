"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WifiSlash, WifiHigh } from "@phosphor-icons/react";

type Status = "online" | "offline" | "reconnected";

export default function OfflineBanner() {
  const [status, setStatus] = useState<Status>("online");

  useEffect(() => {
    if (!navigator.onLine) {
      setStatus("offline");
    }

    function handleOffline() {
      setStatus("offline");
    }

    function handleOnline() {
      setStatus("reconnected");
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    if (status !== "reconnected") return;
    const timer = setTimeout(() => setStatus("online"), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  const visible = status === "offline" || status === "reconnected";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="alert"
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={`fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium ${
            status === "offline"
              ? "bg-amber-500 text-amber-950 dark:bg-amber-600 dark:text-amber-50"
              : "bg-emerald-500 text-emerald-950 dark:bg-emerald-600 dark:text-emerald-50"
          }`}
        >
          {status === "offline" ? (
            <>
              <WifiSlash size={18} weight="bold" />
              <span>
                You&apos;re offline. Some features may not work.
              </span>
            </>
          ) : (
            <>
              <WifiHigh size={18} weight="bold" />
              <span>Back online!</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
