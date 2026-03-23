'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Question,
  MagnifyingGlass,
  CaretDown,
  EnvelopeSimple,
  ArrowRight,
  Compass,
  ChatCircleDots,
  MapTrifold,
  GearSix,
  CreditCard,
  ShieldCheck,
} from '@phosphor-icons/react';

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'How do I create a trip plan?',
    answer: (
      <span>
        Start a conversation with our AI assistant from the home page.
        Describe your destination, travel dates, budget, and
        preferences. The AI will generate a personalized itinerary you
        can review, edit, and save to your trips.
      </span>
    ),
  },
  {
    question: 'Can I edit my itinerary?',
    answer: (
      <span>
        Yes. Open any saved trip from{' '}
        <Link
          href="/trips"
          className="font-medium text-[var(--primary-main)] underline"
        >
          My Trips
        </Link>
        . You can drag and reorder activities, add or remove stops,
        adjust times, and update notes for each day of your itinerary.
      </span>
    ),
  },
  {
    question: 'How do I share my trip?',
    answer: (
      <span>
        Open a trip and use the share button to generate a shareable
        link. You can send this link to travel companions so they can
        view the itinerary. Collaborative editing is coming soon.
      </span>
    ),
  },
  {
    question: 'What are the subscription tiers?',
    answer: (
      <span>
        We offer Free, Pro, and Business tiers with increasing AI
        usage limits, export options, and collaboration features. Visit
        the{' '}
        <Link
          href="/subscription"
          className="font-medium text-[var(--primary-main)] underline"
        >
          Subscription
        </Link>{' '}
        page for full details and pricing.
      </span>
    ),
  },
  {
    question: 'How does the AI plan my trip?',
    answer: (
      <span>
        Our AI uses a multi-agent pipeline: one agent understands your
        preferences, another searches for flights, hotels, and
        activities, and a synthesizer assembles everything into a
        coherent day-by-day itinerary optimized for travel time and
        your interests.
      </span>
    ),
  },
  {
    question: 'Can I export my itinerary?',
    answer: (
      <span>
        Yes. From any trip page you can export your itinerary as an
        ICS file, which you can import into Google Calendar, Apple
        Calendar, or Outlook to keep your schedule synced.
      </span>
    ),
  },
  {
    question: 'How do I change my travel preferences?',
    answer: (
      <span>
        Head to the{' '}
        <Link
          href="/onboarding"
          className="font-medium text-[var(--primary-main)] underline"
        >
          Onboarding
        </Link>{' '}
        page to update your travel style, dietary restrictions, budget
        range, and activity preferences. The AI uses these to
        personalize every trip.
      </span>
    ),
  },
  {
    question: 'Is my data private?',
    answer: (
      <span>
        Absolutely. We do not sell your data. Your trip plans and
        personal information are encrypted and stored securely. Read
        our full{' '}
        <Link
          href="/privacy"
          className="font-medium text-[var(--primary-main)] underline"
        >
          Privacy Policy
        </Link>{' '}
        for details on data handling and retention.
      </span>
    ),
  },
  {
    question: 'How do I switch to dark mode?',
    answer: (
      <span>
        Go to{' '}
        <Link
          href="/appearance"
          className="font-medium text-[var(--primary-main)] underline"
        >
          Appearance
        </Link>{' '}
        in your settings to toggle between light, dark, and system
        themes. Your preference is saved and applied across all
        devices.
      </span>
    ),
  },
  {
    question: 'How do I contact support?',
    answer: (
      <span>
        Email us at{' '}
        <a
          href="mailto:support@atrips.com"
          className="font-medium text-[var(--primary-main)] underline"
        >
          support@atrips.com
        </a>
        . We typically respond within 24 hours. For account-specific
        issues, include your registered email address so we can locate
        your account quickly.
      </span>
    ),
  },
];

interface QuickLink {
  label: string;
  href: string;
  icon: React.ReactNode;
  description: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    label: 'Getting Started',
    href: '/explore',
    icon: <Compass size={20} weight="duotone" />,
    description: 'Explore destinations and ideas',
  },
  {
    label: 'Plan a Trip',
    href: '/',
    icon: <ChatCircleDots size={20} weight="duotone" />,
    description: 'Chat with the AI planner',
  },
  {
    label: 'My Trips',
    href: '/trips',
    icon: <MapTrifold size={20} weight="duotone" />,
    description: 'View and manage your trips',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <GearSix size={20} weight="duotone" />,
    description: 'Account and preferences',
  },
  {
    label: 'Subscription',
    href: '/subscription',
    icon: <CreditCard size={20} weight="duotone" />,
    description: 'Plans and billing',
  },
  {
    label: 'Privacy Policy',
    href: '/privacy',
    icon: <ShieldCheck size={20} weight="duotone" />,
    description: 'How we handle your data',
  },
];

function FAQAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-[var(--neutral-30)] last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 py-4 text-left"
      >
        <span className="text-sm font-medium text-[var(--neutral-100)]">
          {item.question}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-[var(--neutral-60)]"
        >
          <CaretDown size={16} weight="bold" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pb-4 text-sm leading-relaxed text-[var(--neutral-60)]">
              {item.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuickLinkCard({ link }: { link: QuickLink }) {
  return (
    <Link href={link.href}>
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
        className="group flex flex-col gap-2 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-4 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)] transition-colors hover:border-[var(--primary-main)]"
      >
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary-surface)] text-[var(--primary-main)]">
            {link.icon}
          </div>
          <ArrowRight
            size={16}
            className="text-[var(--neutral-40)] transition-colors group-hover:text-[var(--primary-main)]"
          />
        </div>
        <span className="text-sm font-medium text-[var(--neutral-100)]">
          {link.label}
        </span>
        <span className="text-xs text-[var(--neutral-60)]">
          {link.description}
        </span>
      </motion.div>
    </Link>
  );
}

function HelpContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filteredFAQ = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_ITEMS;
    const query = searchQuery.toLowerCase();
    return FAQ_ITEMS.filter(
      (item) =>
        item.question.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  function handleToggle(index: number) {
    setOpenIndex((prev) => (prev === index ? null : index));
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6 flex items-center gap-3"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-surface)]">
          <Question
            size={20}
            weight="fill"
            className="text-[var(--primary-main)]"
          />
        </div>
        <h2 className="text-xl font-semibold text-[var(--neutral-100)]">
          Help & Support
        </h2>
      </motion.div>

      {/* Search bar */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mb-8"
      >
        <div className="relative">
          <MagnifyingGlass
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neutral-50)]"
          />
          <input
            type="text"
            placeholder="How can we help you?"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOpenIndex(null);
            }}
            className="w-full rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] py-2.5 pl-10 pr-4 text-sm text-[var(--neutral-100)] placeholder:text-[var(--neutral-50)] focus:border-[var(--primary-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-main)]"
          />
        </div>
      </motion.div>

      {/* FAQ section */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="mb-10 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-5 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
      >
        <h3 className="border-b border-[var(--neutral-30)] py-4 text-sm font-semibold uppercase tracking-wider text-[var(--neutral-60)]">
          Frequently Asked Questions
        </h3>
        {filteredFAQ.length > 0 ? (
          filteredFAQ.map((item, i) => (
            <FAQAccordionItem
              key={item.question}
              item={item}
              isOpen={openIndex === i}
              onToggle={() => handleToggle(i)}
            />
          ))
        ) : (
          <div className="py-8 text-center text-sm text-[var(--neutral-60)]">
            No results found for &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </motion.div>

      {/* Quick links */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
        className="mb-10"
      >
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--neutral-60)]">
          Quick Links
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <QuickLinkCard key={link.label} link={link} />
          ))}
        </div>
      </motion.div>

      {/* Contact section */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.35 }}
        className="rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-6 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-surface)] text-[var(--primary-main)]">
            <EnvelopeSimple size={18} weight="duotone" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--neutral-100)]">
              Still need help?
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--neutral-60)]">
              Reach out to us at{' '}
              <a
                href="mailto:support@atrips.com"
                className="font-medium text-[var(--primary-main)] underline"
              >
                support@atrips.com
              </a>
              . We typically respond within 24 hours.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function HelpPage() {
  return <HelpContent />;
}
