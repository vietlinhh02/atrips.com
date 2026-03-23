'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bed,
  ForkKnife,
  Car,
  MapPin,
  ShoppingBag,
  DotsThree,
} from '@phosphor-icons/react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';

import { cn } from '@/src/lib/utils';

// ============================================
// Types
// ============================================

interface BudgetCategory {
  name: string;
  amount: number;
  color?: string;
}

interface DailySpend {
  day: number;
  amount: number;
  label?: string;
}

interface BudgetBreakdownProps {
  totalBudget: number;
  currency?: string;
  categories: BudgetCategory[];
  dailySpend?: DailySpend[];
  compact?: boolean;
}

// ============================================
// Constants
// ============================================

const CATEGORY_COLORS: Record<string, string> = {
  accommodation: '#4F46E5',
  'lưu trú': '#4F46E5',
  hotel: '#4F46E5',
  'food & dining': '#059669',
  food: '#059669',
  'ăn uống': '#059669',
  dining: '#059669',
  transportation: '#D97706',
  'di chuyển': '#D97706',
  transport: '#D97706',
  activities: '#DC2626',
  'hoạt động': '#DC2626',
  activity: '#DC2626',
  shopping: '#7C3AED',
  other: '#6B7280',
  'khác': '#6B7280',
  miscellaneous: '#6B7280',
};

const CATEGORY_ICONS: Record<string, PhosphorIcon> = {
  accommodation: Bed,
  'lưu trú': Bed,
  hotel: Bed,
  'food & dining': ForkKnife,
  food: ForkKnife,
  'ăn uống': ForkKnife,
  dining: ForkKnife,
  transportation: Car,
  'di chuyển': Car,
  transport: Car,
  activities: MapPin,
  'hoạt động': MapPin,
  activity: MapPin,
  shopping: ShoppingBag,
  other: DotsThree,
  'khác': DotsThree,
  miscellaneous: DotsThree,
};

const FALLBACK_COLORS = [
  '#4F46E5',
  '#059669',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#6B7280',
];

const DONUT_SIZE = 140;
const DONUT_STROKE = 22;
const DONUT_RADIUS = (DONUT_SIZE - DONUT_STROKE) / 2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

// ============================================
// Helpers
// ============================================

function formatAmount(
  amount: number,
  currency: string
): string {
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

function formatCompactAmount(
  amount: number,
  currency: string
): string {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const formatted = millions % 1 === 0
      ? millions.toFixed(0)
      : millions.toFixed(1);
    return `${formatted}M`;
  }
  if (amount >= 1_000) {
    const thousands = amount / 1_000;
    const formatted = thousands % 1 === 0
      ? thousands.toFixed(0)
      : thousands.toFixed(1);
    return `${formatted}K`;
  }
  return formatAmount(amount, currency);
}

function getCategoryColor(
  name: string,
  explicitColor: string | undefined,
  index: number
): string {
  if (explicitColor) return explicitColor;
  const key = name.toLowerCase().trim();
  return CATEGORY_COLORS[key]
    ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function getCategoryIcon(name: string): PhosphorIcon {
  const key = name.toLowerCase().trim();
  return CATEGORY_ICONS[key] ?? DotsThree;
}

function getBudgetStatus(
  spent: number,
  total: number
): { color: string; bgColor: string; label: string } {
  const ratio = total > 0 ? spent / total : 0;
  if (ratio > 1) {
    return {
      color: '#DC2626',
      bgColor: '#FEE2E2',
      label: 'Over budget',
    };
  }
  if (ratio >= 0.8) {
    return {
      color: '#D97706',
      bgColor: '#FEF3C7',
      label: 'Near budget',
    };
  }
  return {
    color: '#059669',
    bgColor: '#D1FAE5',
    label: 'On track',
  };
}

// ============================================
// Donut Chart
// ============================================

function DonutChart({
  categories,
  totalSpent,
  currency,
}: {
  categories: { name: string; amount: number; color: string; percentage: number }[];
  totalSpent: number;
  currency: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const center = DONUT_SIZE / 2;
  let accumulatedOffset = 0;

  const segments = categories.map((cat) => {
    const segmentLength =
      (cat.percentage / 100) * DONUT_CIRCUMFERENCE;
    const gap = categories.length > 1 ? 3 : 0;
    const adjustedLength = Math.max(segmentLength - gap, 1);
    const offset = accumulatedOffset;
    accumulatedOffset += segmentLength;

    return {
      ...cat,
      dashArray: `${adjustedLength} ${DONUT_CIRCUMFERENCE - adjustedLength}`,
      dashOffset: -offset,
      animatedDashOffset: -(DONUT_CIRCUMFERENCE) + adjustedLength,
    };
  });

  return (
    <div className="relative mx-auto" style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
      <svg
        width={DONUT_SIZE}
        height={DONUT_SIZE}
        viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
        className="rotate-[-90deg]"
      >
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={DONUT_RADIUS}
          fill="none"
          stroke="var(--neutral-30)"
          strokeWidth={DONUT_STROKE}
        />

        {segments.map((seg) => (
          <circle
            key={seg.name}
            cx={center}
            cy={center}
            r={DONUT_RADIUS}
            fill="none"
            stroke={seg.color}
            strokeWidth={DONUT_STROKE}
            strokeDasharray={seg.dashArray}
            strokeDashoffset={
              mounted ? seg.dashOffset : seg.animatedDashOffset
            }
            strokeLinecap="butt"
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        ))}
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] text-[var(--neutral-60)] leading-none">
          Total
        </span>
        <span className="mt-0.5 text-[14px] font-semibold text-[var(--neutral-100)] leading-tight">
          {formatCompactAmount(totalSpent, currency)}
        </span>
      </div>
    </div>
  );
}

// ============================================
// Legend
// ============================================

function Legend({
  categories,
  currency,
  compact,
}: {
  categories: { name: string; amount: number; color: string; percentage: number }[];
  currency: string;
  compact?: boolean;
}) {
  return (
    <div className={cn(
      'grid gap-1.5',
      compact ? 'grid-cols-2' : 'grid-cols-1'
    )}>
      {categories.map((cat, index) => {
        const IconComp = getCategoryIcon(cat.name);
        return (
          <motion.div
            key={cat.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + index * 0.05, duration: 0.3 }}
            className="flex items-center gap-2 text-[12px]"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: cat.color }}
            />
            {!compact && (
              <IconComp
                size={14}
                weight="regular"
                className="shrink-0 text-[var(--neutral-60)]"
              />
            )}
            <span className="truncate text-[var(--neutral-100)]">
              {cat.name}
            </span>
            <span className="ml-auto shrink-0 font-medium text-[var(--neutral-100)] whitespace-nowrap">
              {compact
                ? `${cat.percentage}%`
                : `${formatAmount(cat.amount, currency)} (${cat.percentage}%)`}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ============================================
// Budget Progress Bar
// ============================================

function BudgetProgressBar({
  spent,
  total,
  currency,
}: {
  spent: number;
  total: number;
  currency: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const percentage = total > 0
    ? Math.min(Math.round((spent / total) * 100), 120)
    : 0;
  const displayPercentage = total > 0
    ? Math.round((spent / total) * 100)
    : 0;
  const barWidth = Math.min(percentage, 100);
  const status = getBudgetStatus(spent, total);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-[var(--neutral-70)]">
          Budget usage
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{
            color: status.color,
            backgroundColor: status.bgColor,
          }}
        >
          {status.label}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--neutral-30)]">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: mounted ? `${barWidth}%` : '0%',
            backgroundColor: status.color,
          }}
        />
      </div>

      <p className="text-[12px] text-[var(--neutral-70)]">
        <span className="font-medium text-[var(--neutral-100)]">
          {formatAmount(spent, currency)}
        </span>
        {' / '}
        {formatAmount(total, currency)}
        {' '}
        <span className="text-[var(--neutral-60)]">
          ({displayPercentage}%)
        </span>
      </p>
    </div>
  );
}

// ============================================
// Per-Day Bar Chart
// ============================================

function DailySpendChart({
  dailySpend,
  currency,
}: {
  dailySpend: DailySpend[];
  currency: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const maxAmount = Math.max(...dailySpend.map((d) => d.amount), 1);
  const avgAmount = dailySpend.length > 0
    ? dailySpend.reduce((sum, d) => sum + d.amount, 0) / dailySpend.length
    : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-[var(--neutral-70)]">
          Daily spending
        </span>
        <span className="text-[var(--neutral-60)]">
          avg {formatCompactAmount(avgAmount, currency)}/day
        </span>
      </div>

      <div className="space-y-1">
        {dailySpend.map((day, index) => {
          const widthPercent = maxAmount > 0
            ? (day.amount / maxAmount) * 100
            : 0;
          const isAboveAvg = day.amount > avgAmount;

          return (
            <motion.div
              key={day.day}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05 * index, duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <span className="w-10 shrink-0 text-[11px] text-[var(--neutral-60)]">
                {day.label ?? `Day ${day.day}`}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded-sm bg-[var(--neutral-20)]">
                <div
                  className="h-full rounded-sm transition-[width] duration-500 ease-out"
                  style={{
                    width: mounted ? `${widthPercent}%` : '0%',
                    backgroundColor: isAboveAvg
                      ? '#D97706'
                      : 'var(--primary-main)',
                    transitionDelay: `${index * 50}ms`,
                  }}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-[11px] font-medium text-[var(--neutral-100)]">
                {formatCompactAmount(day.amount, currency)}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function BudgetBreakdown({
  totalBudget,
  currency = 'VND',
  categories,
  dailySpend,
  compact = false,
}: BudgetBreakdownProps) {
  const processedCategories = useMemo(() => {
    const validCategories = categories.filter((c) => c.amount > 0);
    if (validCategories.length === 0) return [];

    const totalSpent = validCategories.reduce(
      (sum, c) => sum + c.amount, 0
    );

    return validCategories.map((cat, index) => ({
      name: cat.name,
      amount: cat.amount,
      color: getCategoryColor(cat.name, cat.color, index),
      percentage: totalSpent > 0
        ? Math.round((cat.amount / totalSpent) * 100)
        : 0,
    }));
  }, [categories]);

  const totalSpent = useMemo(
    () => processedCategories.reduce((sum, c) => sum + c.amount, 0),
    [processedCategories]
  );

  if (processedCategories.length === 0) {
    return (
      <div className="flex items-center justify-center py-4 text-[13px] text-[var(--neutral-60)]">
        No budget data available
      </div>
    );
  }

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-3"
      >
        <DonutChart
          categories={processedCategories}
          totalSpent={totalSpent}
          currency={currency}
        />
        <Legend
          categories={processedCategories}
          currency={currency}
          compact
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-4"
    >
      {/* Donut + Legend */}
      <div className="rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-20)] p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--neutral-70)]">
          Budget allocation
        </p>
        <div className="mt-3 flex flex-col sm:flex-row items-center gap-4">
          <DonutChart
            categories={processedCategories}
            totalSpent={totalSpent}
            currency={currency}
          />
          <div className="flex-1 w-full">
            <Legend
              categories={processedCategories}
              currency={currency}
            />
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {totalBudget > 0 && (
        <div className="rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-20)] p-3.5">
          <BudgetProgressBar
            spent={totalSpent}
            total={totalBudget}
            currency={currency}
          />
        </div>
      )}

      {/* Daily spend */}
      {dailySpend && dailySpend.length > 0 && (
        <div className="rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-20)] p-3.5">
          <DailySpendChart
            dailySpend={dailySpend}
            currency={currency}
          />
        </div>
      )}
    </motion.div>
  );
}
