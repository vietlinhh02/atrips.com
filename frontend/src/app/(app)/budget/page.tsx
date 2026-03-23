'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CurrencyDollar,
  TrendUp,
  Airplane,
  Lightbulb,
  CalendarBlank,
  Ticket,
  Train,
  BowlFood,
  MapPin,
  Receipt,
} from '@phosphor-icons/react';
import { Badge } from '@/src/components/ui/badge';
import tripService from '@/src/services/tripService';
import type { Trip } from '@/src/services/tripService';

// --- Animated Counter ---

function AnimatedCounter({
  value,
  duration = 1.2,
  prefix = '',
  suffix = '',
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }

    let start: number | null = null;
    let raf: number;
    const ms = duration * 1000;

    function step(timestamp: number) {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / ms, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    }

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </>
  );
}

// --- Stat Card ---

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  delay: number;
  children: React.ReactNode;
}

function StatCard({ icon, label, delay, children }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="flex flex-col gap-2 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-5 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-surface)]">
        {icon}
      </div>
      <span className="text-2xl font-semibold text-[var(--neutral-100)]">
        {children}
      </span>
      <span className="text-xs text-[var(--neutral-60)]">{label}</span>
    </motion.div>
  );
}

// --- Currency Formatter ---

function formatBudget(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const startStr = s.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const endStr = e.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startStr} - ${endStr}`;
}

// --- Status Badge ---

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  ARCHIVED: 'bg-[var(--neutral-30)] text-[var(--neutral-60)]',
};

// --- Budget Tips ---

const BUDGET_TIPS = [
  {
    icon: Airplane,
    title: 'Book flights early',
    description:
      'Book flights 6-8 weeks in advance for best prices.',
  },
  {
    icon: BowlFood,
    title: 'Eat like a local',
    description:
      'Street food in Southeast Asia averages $2-5 per meal.',
  },
  {
    icon: CalendarBlank,
    title: 'Travel off-peak',
    description:
      'Consider shoulder season for 30-50% savings on accommodation.',
  },
  {
    icon: Train,
    title: 'Use public transit',
    description:
      'Use public transit instead of taxis to save up to 70%.',
  },
];

// --- Skeleton ---

function PageSkeleton() {
  return (
    <div className="w-full px-6 py-6">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-6">
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-5"
            >
              <div className="h-10 w-10 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-6 w-20 rounded bg-gray-100 animate-pulse" />
              <div className="h-3 w-28 rounded bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
        {/* Table skeleton */}
        <div className="rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-6">
          <div className="h-5 w-40 rounded bg-gray-100 animate-pulse mb-4" />
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-lg bg-[var(--neutral-20)] p-4"
              >
                <div className="h-4 w-40 rounded bg-gray-100 animate-pulse" />
                <div className="h-4 w-32 rounded bg-gray-100 animate-pulse" />
                <div className="ml-auto h-4 w-24 rounded bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Budget Content ---

function BudgetContent() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await tripService.listTrips({ limit: 100 });
      setTrips(result.trips);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load trips';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const tripsWithBudget = useMemo(
    () =>
      trips
        .filter(
          (t) => t.budgetTotal !== null && Number(t.budgetTotal) > 0,
        )
        .sort((a, b) => Number(b.budgetTotal ?? 0) - Number(a.budgetTotal ?? 0)),
    [trips],
  );

  const stats = useMemo(() => {
    if (tripsWithBudget.length === 0) {
      return {
        totalBudget: 0,
        averageBudget: 0,
        tripCount: 0,
        mostExpensive: null as Trip | null,
        currency: 'USD',
      };
    }

    const totalBudget = tripsWithBudget.reduce(
      (sum, t) => sum + Number(t.budgetTotal ?? 0),
      0,
    );
    const averageBudget = Math.round(
      totalBudget / tripsWithBudget.length,
    );
    const mostExpensive = tripsWithBudget[0] ?? null;
    const currency = mostExpensive?.budgetCurrency ?? 'USD';

    return {
      totalBudget,
      averageBudget,
      tripCount: tripsWithBudget.length,
      mostExpensive,
      currency,
    };
  }, [tripsWithBudget]);

  if (isLoading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-20">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={fetchTrips}
          className="rounded-[4px] bg-[var(--primary-main)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--primary-hover)]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (tripsWithBudget.length === 0) {
    return (
      <div className="w-full px-6 py-6">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center gap-4 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-8 py-16 text-center shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary-surface)]">
              <CurrencyDollar
                size={32}
                weight="duotone"
                className="text-[var(--primary-main)]"
              />
            </div>
            <h2 className="text-lg font-semibold text-[var(--neutral-100)]">
              No budget data yet
            </h2>
            <p className="max-w-sm text-sm text-[var(--neutral-60)]">
              Plan a trip with a budget to see your spending overview
              and travel budget insights here.
            </p>
            <Link
              href="/chat"
              className="mt-2 flex items-center gap-1.5 rounded-[4px] bg-[var(--primary-main)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
            >
              <Airplane size={16} weight="bold" />
              Plan a Trip
            </Link>
          </motion.div>

          {/* Still show tips even when empty */}
          <BudgetTipsSection />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-6">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={
              <CurrencyDollar
                size={20}
                weight="duotone"
                className="text-[var(--primary-main)]"
              />
            }
            label="Total Budget"
            delay={0.1}
          >
            <AnimatedCounter
              value={stats.totalBudget}
              prefix={getCurrencySymbol(stats.currency)}
            />
          </StatCard>

          <StatCard
            icon={
              <TrendUp
                size={20}
                weight="duotone"
                className="text-[var(--primary-main)]"
              />
            }
            label="Average Per Trip"
            delay={0.15}
          >
            <AnimatedCounter
              value={stats.averageBudget}
              prefix={getCurrencySymbol(stats.currency)}
            />
          </StatCard>

          <StatCard
            icon={
              <Airplane
                size={20}
                weight="duotone"
                className="text-[var(--primary-main)]"
              />
            }
            label="Trips with Budget"
            delay={0.2}
          >
            <AnimatedCounter value={stats.tripCount} />
          </StatCard>

          <StatCard
            icon={
              <Ticket
                size={20}
                weight="duotone"
                className="text-[var(--primary-main)]"
              />
            }
            label="Most Expensive Trip"
            delay={0.25}
          >
            <span className="text-lg leading-tight">
              {stats.mostExpensive
                ? formatBudget(
                    Number(stats.mostExpensive.budgetTotal ?? 0),
                    stats.mostExpensive.budgetCurrency,
                  )
                : '--'}
            </span>
          </StatCard>
        </div>

        {/* Most Expensive Trip Name */}
        {stats.mostExpensive && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-[-12px] text-right text-xs text-[var(--neutral-60)]"
          >
            {stats.mostExpensive.title}
          </motion.p>
        )}

        {/* Per-Trip Budget List */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-6 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
        >
          <h3 className="mb-4 text-base font-medium text-[var(--neutral-100)]">
            Budget by Trip
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tripsWithBudget.map((trip, index) => {
              const budget = Number(trip.budgetTotal ?? 0);
              const maxBudget =
                Number(tripsWithBudget[0]?.budgetTotal ?? 1);
              const pct = Math.round((budget / maxBudget) * 100);

              return (
                <motion.button
                  key={trip.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.25,
                    delay: 0.3 + index * 0.04,
                  }}
                  onClick={() => router.push(`/chat?tripId=${trip.id}`)}
                  className="group flex flex-col gap-3 rounded-lg border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-4 text-left transition-all hover:border-[var(--primary-main)] hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin
                        size={16}
                        weight="duotone"
                        className="shrink-0 text-[var(--neutral-50)]"
                      />
                      <span className="text-sm font-medium text-[var(--neutral-100)] group-hover:text-[var(--primary-main)] transition-colors truncate">
                        {trip.title}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`${STATUS_STYLES[trip.status] ?? STATUS_STYLES.DRAFT} text-[10px] font-medium px-1.5 py-0 shrink-0`}
                    >
                      {trip.status}
                    </Badge>
                  </div>

                  <span className="text-xl font-semibold text-[var(--neutral-100)]">
                    {formatBudget(budget, trip.budgetCurrency)}
                  </span>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--neutral-30)]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{
                        duration: 0.6,
                        delay: 0.4 + index * 0.04,
                        ease: 'easeOut',
                      }}
                      className="h-full rounded-full bg-[var(--primary-main)]"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--neutral-60)]">
                      <CalendarBlank
                        size={12}
                        weight="regular"
                        className="mr-1 inline-block"
                      />
                      {formatDateRange(trip.startDate, trip.endDate)}
                    </span>
                    <Link
                      href={`/budget/${trip.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs font-medium text-[var(--primary-main)] transition-colors hover:text-[var(--primary-hover)]"
                    >
                      <Receipt size={14} weight="duotone" />
                      Expenses
                    </Link>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Budget Tips */}
        <BudgetTipsSection />
      </div>
    </div>
  );
}

// --- Budget Tips Section ---

function BudgetTipsSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.4 }}
      className="rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-6 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
    >
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb
          size={20}
          weight="duotone"
          className="text-amber-500"
        />
        <h3 className="text-base font-medium text-[var(--neutral-100)]">
          Budget Tips
        </h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {BUDGET_TIPS.map((tip, index) => {
          const Icon = tip.icon;
          return (
            <motion.div
              key={tip.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: 0.45 + index * 0.06,
              }}
              className="flex gap-3 rounded-lg border border-[var(--neutral-30)] bg-[var(--neutral-20)] p-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-surface)]">
                <Icon
                  size={18}
                  weight="duotone"
                  className="text-[var(--primary-main)]"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-[var(--neutral-100)]">
                  {tip.title}
                </span>
                <span className="text-xs leading-relaxed text-[var(--neutral-60)]">
                  {tip.description}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// --- Currency Symbol Helper ---

function getCurrencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? '';
  } catch {
    return '';
  }
}

// --- Page ---

export default function BudgetPage() {
  return <BudgetContent />;
}
