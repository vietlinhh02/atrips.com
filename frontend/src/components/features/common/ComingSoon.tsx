'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Bell } from '@phosphor-icons/react';
import { Badge } from '@/src/components/ui/badge';
import { toast } from '@/src/components/ui/use-toast';

interface FeaturePreview {
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: string;
  bgColor: string;
}

interface PreviewCard {
  title: string;
  subtitle: string;
  imageUrl: string;
  location: string;
}

interface ComingSoonProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bannerHeading: string;
  bannerDescription: string;
  features: FeaturePreview[];
  previewCards?: PreviewCard[];
}

function FeatureCard({
  feature,
  index,
}: {
  feature: FeaturePreview;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
      className="flex flex-col items-center rounded-2xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-6 text-center shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
    >
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${feature.bgColor} ${feature.accentColor}`}
      >
        {feature.icon}
      </div>
      <h3 className="mb-2 text-base font-semibold text-[var(--neutral-100)]">
        {feature.title}
      </h3>
      <p className="text-sm leading-relaxed text-[var(--neutral-60)]">
        {feature.description}
      </p>
    </motion.div>
  );
}

function PreviewCardItem({
  card,
  index,
}: {
  card: PreviewCard;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 0.5, y: 0 }}
      transition={{ duration: 0.35, delay: 0.6 + index * 0.1 }}
      className="overflow-hidden rounded-2xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] opacity-50"
    >
      <div className="relative h-36 w-full">
        <Image
          src={card.imageUrl}
          alt={card.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-2 left-3 text-xs font-medium text-white">
          {card.location}
        </div>
      </div>
      <div className="p-4">
        <h4 className="mb-1 text-sm font-semibold text-[var(--neutral-100)]">
          {card.title}
        </h4>
        <p className="text-xs text-[var(--neutral-60)]">{card.subtitle}</p>
      </div>
    </motion.div>
  );
}

export default function ComingSoon({
  icon,
  title,
  subtitle,
  bannerHeading,
  bannerDescription,
  features,
  previewCards,
}: ComingSoonProps) {
  function handleGetNotified() {
    toast.success(`You'll be notified when ${title} launches!`);
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-8 md:px-6">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-2 flex items-center gap-3"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-surface)]">
          <span className="text-[var(--primary-main)]">{icon}</span>
        </div>
        <h2 className="text-xl font-semibold text-[var(--neutral-100)]">
          {title}
        </h2>
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mb-8 text-sm text-[var(--neutral-60)]"
      >
        {subtitle}
      </motion.p>

      {/* Feature preview cards */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {features.map((feature, i) => (
          <FeatureCard key={feature.title} feature={feature} index={i} />
        ))}
      </div>

      {/* Coming soon banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mb-10 flex flex-col items-center rounded-2xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-6 py-10 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
      >
        <Badge
          variant="secondary"
          className="mb-4 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 text-[11px] font-semibold tracking-wide uppercase px-3 py-1"
        >
          Coming Soon
        </Badge>
        <h3 className="mb-2 text-lg font-semibold text-[var(--neutral-100)]">
          {bannerHeading}
        </h3>
        <p className="mb-6 max-w-lg text-center text-sm leading-relaxed text-[var(--neutral-60)]">
          {bannerDescription}
        </p>
        <button
          onClick={handleGetNotified}
          className="flex items-center gap-2 rounded-full bg-[var(--primary-main)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
        >
          <Bell size={16} weight="fill" />
          Get Notified
        </button>
      </motion.div>

      {/* Preview cards */}
      {previewCards && previewCards.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {previewCards.map((card, i) => (
            <PreviewCardItem key={card.title} card={card} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
