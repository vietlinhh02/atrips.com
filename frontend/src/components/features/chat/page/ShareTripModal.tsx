'use client';

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Copy,
  EnvelopeSimple,
  Globe,
  Lock,
  ShareNetwork,
  Users,
  WhatsappLogo,
  X,
  XLogo,
} from '@phosphor-icons/react';

import shareService from '@/src/services/shareService';
import tripService from '@/src/services/tripService';
import { toast } from '@/src/components/ui/use-toast';

type TripVisibility = 'PRIVATE' | 'SHARED' | 'PUBLIC';

interface ShareTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  tripTitle: string;
  currentVisibility: TripVisibility;
  initialShareToken?: string;
}

const VISIBILITY_OPTIONS = [
  {
    value: 'PRIVATE' as const,
    label: 'Private',
    description: 'Only you can see this trip',
    Icon: Lock,
  },
  {
    value: 'SHARED' as const,
    label: 'Shared',
    description: 'Anyone with the link can view',
    Icon: Users,
  },
  {
    value: 'PUBLIC' as const,
    label: 'Public',
    description: 'Visible to everyone',
    Icon: Globe,
  },
];

function buildShareUrl(token: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/trips/shared/${token}`;
}

export default function ShareTripModal({
  isOpen,
  onClose,
  tripId,
  tripTitle,
  currentVisibility,
  initialShareToken,
}: ShareTripModalProps) {
  const [visibility, setVisibility] = useState<TripVisibility>(
    currentVisibility
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(
    initialShareToken ?? null
  );

  const shareUrl = shareToken ? buildShareUrl(shareToken) : '';
  const showShareLink = shareToken !== null;

  const handleVisibilityChange = useCallback(
    async (newVisibility: TripVisibility) => {
      if (newVisibility === visibility || isUpdating) return;

      setIsUpdating(true);
      try {
        if (newVisibility === 'SHARED' || newVisibility === 'PUBLIC') {
          const { shareToken: token } =
            await shareService.shareTrip(tripId);
          setShareToken(token);
        } else if (
          newVisibility === 'PRIVATE' &&
          (visibility === 'SHARED' || visibility === 'PUBLIC')
        ) {
          await shareService.revokeShare(tripId);
          setShareToken(null);
        }
        await tripService.updateTrip(tripId, {
          visibility: newVisibility,
        });
        setVisibility(newVisibility);
        toast.success('Visibility updated');
      } catch {
        toast.error(
          'Failed to update visibility',
          'Please try again'
        );
      } finally {
        setIsUpdating(false);
      }
    },
    [tripId, visibility, isUpdating]
  );

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  }, [shareUrl]);

  const handleEmailShare = useCallback(() => {
    const subject = encodeURIComponent(
      `Check out my trip: ${tripTitle}`
    );
    const body = encodeURIComponent(
      `I planned a trip on atrips.com! Check it out:\n\n${shareUrl}`
    );
    window.open(
      `mailto:?subject=${subject}&body=${body}`,
      '_blank'
    );
  }, [tripTitle, shareUrl]);

  const handleWhatsAppShare = useCallback(() => {
    const text = encodeURIComponent(
      `Check out my trip plan: ${tripTitle}\n${shareUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }, [tripTitle, shareUrl]);

  const handleTwitterShare = useCallback(() => {
    const text = encodeURIComponent(
      `Check out my trip plan: ${tripTitle}`
    );
    const url = encodeURIComponent(shareUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      '_blank'
    );
  }, [tripTitle, shareUrl]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
            }}
            className="w-full max-w-[420px] rounded-[16px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <ShareNetwork
                  size={20}
                  className="text-[var(--primary-main)]"
                />
                <h3 className="text-[16px] font-semibold text-[var(--neutral-100)]">
                  Share Trip
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-[var(--neutral-60)] hover:bg-[var(--neutral-20)] hover:text-[var(--neutral-100)] transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Visibility Options */}
            <div className="px-5 pb-4 space-y-2">
              <p className="text-[13px] font-medium text-[var(--neutral-70)] mb-2">
                Who can see this trip?
              </p>
              {VISIBILITY_OPTIONS.map((option) => {
                const isSelected = visibility === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isUpdating}
                    onClick={() =>
                      handleVisibilityChange(option.value)
                    }
                    className={`flex w-full items-center gap-3 rounded-[10px] border px-3.5 py-3 text-left transition-all ${
                      isSelected
                        ? 'border-[var(--primary-main)] bg-[var(--primary-surface)]'
                        : 'border-[var(--neutral-30)] bg-transparent hover:border-[var(--neutral-40)] hover:bg-[var(--neutral-20)]'
                    } ${isUpdating ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        isSelected
                          ? 'bg-[var(--primary-main)] text-white'
                          : 'bg-[var(--neutral-30)] text-[var(--neutral-60)]'
                      }`}
                    >
                      <option.Icon
                        size={18}
                        weight={isSelected ? 'fill' : 'regular'}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-[14px] font-medium ${
                          isSelected
                            ? 'text-[var(--primary-main)]'
                            : 'text-[var(--neutral-100)]'
                        }`}
                      >
                        {option.label}
                      </p>
                      <p className="text-[12px] text-[var(--neutral-60)]">
                        {option.description}
                      </p>
                    </div>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="shrink-0"
                      >
                        <Check
                          size={18}
                          weight="bold"
                          className="text-[var(--primary-main)]"
                        />
                      </motion.div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Share Link Section */}
            <AnimatePresence>
              {showShareLink && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-[var(--neutral-30)] px-5 pt-4 pb-5 space-y-3">
                    <p className="text-[13px] font-medium text-[var(--neutral-70)]">
                      Share link
                    </p>

                    {/* URL + Copy */}
                    <div className="flex items-center gap-2 rounded-[8px] border border-[var(--neutral-30)] bg-[var(--neutral-20)] px-3 py-2">
                      <span className="flex-1 truncate text-[13px] text-[var(--neutral-70)] select-all">
                        {shareUrl}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="shrink-0 rounded-[6px] bg-[var(--neutral-10)] border border-[var(--neutral-30)] px-2.5 py-1 text-[12px] font-medium text-[var(--neutral-80)] hover:bg-[var(--neutral-30)] transition-colors flex items-center gap-1.5"
                      >
                        {copied ? (
                          <>
                            <Check size={14} />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            Copy
                          </>
                        )}
                      </button>
                    </div>

                    {/* Share Buttons */}
                    <div className="flex items-center gap-2">
                      <ShareButton
                        onClick={handleCopyLink}
                        icon={<Copy size={18} />}
                        label="Copy Link"
                      />
                      <ShareButton
                        onClick={handleEmailShare}
                        icon={<EnvelopeSimple size={18} />}
                        label="Email"
                      />
                      <ShareButton
                        onClick={handleWhatsAppShare}
                        icon={<WhatsappLogo size={18} />}
                        label="WhatsApp"
                      />
                      <ShareButton
                        onClick={handleTwitterShare}
                        icon={<XLogo size={18} />}
                        label="X"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ShareButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1.5 rounded-[8px] border border-[var(--neutral-30)] py-2.5 text-[var(--neutral-70)] hover:bg-[var(--neutral-20)] hover:text-[var(--neutral-100)] transition-colors"
    >
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
