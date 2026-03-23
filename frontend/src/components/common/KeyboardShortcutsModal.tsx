'use client';

import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Keyboard, Command, X } from '@phosphor-icons/react';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
}

function useIsMac(): boolean {
  return useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  }, []);
}

const SHORTCUT_DEFINITIONS: Array<{
  macKeys: string[];
  winKeys: string[];
  description: string;
}> = [
  {
    macKeys: ['\u2318', 'K'],
    winKeys: ['Ctrl', 'K'],
    description: 'Focus chat input',
  },
  {
    macKeys: ['\u2318', 'N'],
    winKeys: ['Ctrl', 'N'],
    description: 'New conversation',
  },
  {
    macKeys: ['\u2318', '/'],
    winKeys: ['Ctrl', '/'],
    description: 'Toggle this help',
  },
  {
    macKeys: ['Esc'],
    winKeys: ['Esc'],
    description: 'Close modal',
  },
];

function KeyBadge({ label }: { label: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-[5px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-1.5 font-mono text-[11px] font-medium text-[var(--neutral-70)] shadow-[0_1px_0_1px_var(--neutral-30)]">
      {label}
    </kbd>
  );
}

function ShortcutRow({ keys, description }: Shortcut) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[13px] text-[var(--neutral-80)]">
        {description}
      </span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <KeyBadge key={i} label={key} />
        ))}
      </div>
    </div>
  );
}

export default function KeyboardShortcutsModal({
  open,
  onClose,
}: KeyboardShortcutsModalProps) {
  const isMac = useIsMac();

  const shortcuts: Shortcut[] = useMemo(
    () =>
      SHORTCUT_DEFINITIONS.map((def) => ({
        keys: isMac ? def.macKeys : def.winKeys,
        description: def.description,
      })),
    [isMac],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () =>
      window.removeEventListener('keydown', handler, { capture: true });
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[100] bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            aria-hidden
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-label="Keyboard shortcuts"
            className="fixed left-1/2 top-1/2 z-[101] w-[360px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] shadow-xl"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--neutral-30)] px-5 py-3.5">
              <div className="flex items-center gap-2 text-[var(--neutral-100)]">
                <Keyboard size={18} weight="bold" />
                <span className="text-[14px] font-semibold">
                  Keyboard Shortcuts
                </span>
              </div>
              <button
                onClick={onClose}
                className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--neutral-50)] transition-colors hover:bg-[var(--neutral-20)] hover:text-[var(--neutral-80)]"
              >
                <X size={14} weight="bold" />
              </button>
            </div>

            {/* Body */}
            <div className="divide-y divide-[var(--neutral-20)] px-5">
              {shortcuts.map((shortcut) => (
                <ShortcutRow
                  key={shortcut.description}
                  keys={shortcut.keys}
                  description={shortcut.description}
                />
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-1.5 border-t border-[var(--neutral-30)] px-5 py-3 text-[11px] text-[var(--neutral-50)]">
              <Command size={12} />
              <span>
                {isMac ? 'Cmd' : 'Ctrl'} + / to toggle this panel
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
