'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  MapTrifold,
  ChatCircleDots,
  Sparkle,
  X,
  SquaresFour,
} from '@phosphor-icons/react';
import { useState, useCallback } from 'react';

interface MobileChatToggleProps {
  activeMobileTab: 'chat' | 'map';
  onTabChange: (tab: 'chat' | 'map') => void;
  showTripPlan?: boolean;
  onTripPlanOpen?: () => void;
}

export default function MobileChatToggle({
  activeMobileTab,
  onTabChange,
  showTripPlan = false,
  onTripPlanOpen,
}: MobileChatToggleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleMainClick = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleMapClick = useCallback(() => {
    onTabChange(activeMobileTab === 'chat' ? 'map' : 'chat');
    setIsExpanded(false);
  }, [activeMobileTab, onTabChange]);

  const handleTripPlanClick = useCallback(() => {
    onTripPlanOpen?.();
    setIsExpanded(false);
  }, [onTripPlanOpen]);

  return (
    <div className="absolute bottom-28 left-5 md:hidden z-40">
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[-1]"
              onClick={() => setIsExpanded(false)}
            />

            {/* Trip Plan button */}
            {showTripPlan && onTripPlanOpen && (
              <motion.button
                key="trip-plan"
                type="button"
                initial={{ opacity: 0, y: 16, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.8 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 22,
                  delay: 0.04,
                }}
                onClick={handleTripPlanClick}
                className="absolute bottom-[124px] left-0 flex items-center gap-2 rounded-full bg-[var(--primary-main)] pl-3 pr-4 py-2.5 text-[13px] font-medium text-white shadow-[0_8px_30px_rgb(0,0,0,0.16)] whitespace-nowrap"
              >
                <Sparkle size={16} weight="fill" />
                Trip Plan
              </motion.button>
            )}

            {/* Map / Chat toggle button */}
            <motion.button
              key="map-toggle"
              type="button"
              initial={{ opacity: 0, y: 16, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.8 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 22,
              }}
              onClick={handleMapClick}
              className="absolute bottom-[64px] left-0 flex items-center gap-2 rounded-full bg-[var(--neutral-100)] pl-3 pr-4 py-2.5 text-[13px] font-medium text-white shadow-[0_8px_30px_rgb(0,0,0,0.16)] whitespace-nowrap"
            >
              {activeMobileTab === 'chat' ? (
                <>
                  <MapTrifold size={16} weight="fill" />
                  Map
                </>
              ) : (
                <>
                  <ChatCircleDots size={16} weight="fill" />
                  Chat
                </>
              )}
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        type="button"
        onClick={handleMainClick}
        whileTap={{ scale: 0.9 }}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--neutral-100)] text-white shadow-[0_8px_30px_rgb(0,0,0,0.16)] hover:bg-black transition-colors select-none"
        aria-label="Toggle actions menu"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isExpanded ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={20} weight="bold" />
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <SquaresFour size={20} weight="fill" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
