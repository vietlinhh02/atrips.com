'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  BowlFood,
  Train,
  Bed,
  Ticket,
  ShoppingBag,
  DotsThree,
  Plus,
  ArrowLeft,
  CurrencyDollar,
  ChartPie,
  Users,
  ArrowsLeftRight,
  X,
  Funnel,
  Check,
  Trash,
} from '@phosphor-icons/react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/src/components/ui/avatar';
import useAuthStore from '@/src/stores/authStore';
import tripService from '@/src/services/tripService';
import expenseService from '@/src/services/expenseService';
import type {
  Expense,
  ExpenseCategory,
  ExpenseSummary,
  Balance,
  CreateExpenseInput,
} from '@/src/services/expenseService';

const CATEGORIES: ExpenseCategory[] = [
  'FOOD',
  'TRANSPORT',
  'ACCOMMODATION',
  'ACTIVITY',
  'SHOPPING',
  'OTHER',
];

const CATEGORY_CONFIG: Record<
  ExpenseCategory,
  {
    icon: typeof BowlFood;
    label: string;
    color: string;
    bg: string;
  }
> = {
  FOOD: {
    icon: BowlFood,
    label: 'Food',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  TRANSPORT: {
    icon: Train,
    label: 'Transport',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  ACCOMMODATION: {
    icon: Bed,
    label: 'Accommodation',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  ACTIVITY: {
    icon: Ticket,
    label: 'Activity',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  SHOPPING: {
    icon: ShoppingBag,
    label: 'Shopping',
    color: 'text-pink-600',
    bg: 'bg-pink-50',
  },
  OTHER: {
    icon: DotsThree,
    label: 'Other',
    color: 'text-gray-600',
    bg: 'bg-gray-50',
  },
};

interface TripMember {
  id: string;
  name: string;
  displayName?: string;
  avatarUrl: string | null;
}

function formatAmount(amount: number, currency: string): string {
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

function userInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function PageSkeleton() {
  return (
    <div className="w-full px-6 py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-5"
            >
              <div className="h-10 w-10 animate-pulse rounded-full bg-gray-100" />
              <div className="h-6 w-20 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-28 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
        <div className="rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-6">
          <div className="mb-4 h-5 w-40 animate-pulse rounded bg-gray-100" />
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-lg bg-[var(--neutral-20)] p-4"
              >
                <div className="h-10 w-10 animate-pulse rounded-full bg-gray-100" />
                <div className="flex-1">
                  <div className="mb-1 h-4 w-40 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
                </div>
                <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryBar({
  breakdown,
  currency,
}: {
  breakdown: ExpenseSummary['categoryBreakdown'];
  currency: string;
}) {
  if (breakdown.length === 0) return null;

  const colorMap: Record<string, string> = {
    FOOD: 'bg-orange-400',
    TRANSPORT: 'bg-blue-400',
    ACCOMMODATION: 'bg-purple-400',
    ACTIVITY: 'bg-green-400',
    SHOPPING: 'bg-pink-400',
    OTHER: 'bg-gray-400',
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {breakdown.map((item) => (
          <motion.div
            key={item.category}
            initial={{ width: 0 }}
            animate={{ width: `${item.percentage}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={`${colorMap[item.category] ?? 'bg-gray-400'} h-full`}
            title={`${CATEGORY_CONFIG[item.category]?.label}: ${formatAmount(item.amount, currency)} (${item.percentage}%)`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {breakdown.map((item) => {
          const config = CATEGORY_CONFIG[item.category];
          return (
            <div key={item.category} className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${colorMap[item.category]}`}
              />
              <span className="text-xs text-[var(--neutral-60)]">
                {config?.label}: {formatAmount(item.amount, currency)} (
                {item.percentage}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoryPicker({
  value,
  onChange,
}: {
  value: ExpenseCategory;
  onChange: (cat: ExpenseCategory) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[var(--neutral-70)]">
        Category
      </label>
      <div className="grid grid-cols-3 gap-2">
        {CATEGORIES.map((cat) => {
          const config = CATEGORY_CONFIG[cat];
          const Icon = config.icon;
          const isSelected = value === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onChange(cat)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                isSelected
                  ? 'border-[var(--primary-main)] bg-[var(--primary-surface)] text-[var(--primary-main)]'
                  : 'border-[var(--neutral-30)] bg-[var(--neutral-10)] text-[var(--neutral-70)] hover:bg-[var(--neutral-20)]'
              }`}
            >
              <Icon size={14} weight="duotone" />
              {config.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SplitMemberPicker({
  members,
  selected,
  onToggle,
  amount,
  currency,
}: {
  members: TripMember[];
  selected: string[];
  onToggle: (userId: string) => void;
  amount: string;
  currency: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[var(--neutral-70)]">
        Split with
      </label>
      <div className="flex flex-wrap gap-2">
        {members.map((m) => {
          const isSelected = selected.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onToggle(m.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isSelected
                  ? 'border-[var(--primary-main)] bg-[var(--primary-surface)] text-[var(--primary-main)]'
                  : 'border-[var(--neutral-30)] text-[var(--neutral-60)] hover:bg-[var(--neutral-20)]'
              }`}
            >
              <Avatar size="sm">
                {m.avatarUrl && (
                  <AvatarImage src={m.avatarUrl} alt={m.name} />
                )}
                <AvatarFallback>{userInitials(m.name)}</AvatarFallback>
              </Avatar>
              {m.displayName ?? m.name}
              {isSelected && <Check size={12} weight="bold" />}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && amount && (
        <p className="text-xs text-[var(--neutral-60)]">
          {formatAmount(parseFloat(amount) / selected.length, currency)}{' '}
          per person
        </p>
      )}
    </div>
  );
}

function buildEqualSplits(
  totalAmount: number,
  userIds: string[]
): Array<{ userId: string; shareAmount: number }> {
  const share = Math.round((totalAmount / userIds.length) * 100) / 100;
  return userIds.map((userId, index) => ({
    userId,
    shareAmount:
      index === userIds.length - 1
        ? Math.round((totalAmount - share * (userIds.length - 1)) * 100) / 100
        : share,
  }));
}

function AddExpenseModal({
  tripId,
  members,
  currentUserId,
  defaultCurrency,
  onClose,
  onCreated,
}: {
  tripId: string;
  members: TripMember[];
  currentUserId: string;
  defaultCurrency: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState<ExpenseCategory>('FOOD');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paidById, setPaidById] = useState(currentUserId);
  const [splitWith, setSplitWith] = useState<string[]>(
    members.map((m) => m.id)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSplitMember(userId: string) {
    setSplitWith((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (splitWith.length === 0) {
      setError('Select at least one member to split with');
      return;
    }

    setIsSubmitting(true);
    try {
      await expenseService.createExpense(tripId, {
        paidById,
        category,
        description: description || undefined,
        amount: parsedAmount,
        currency: defaultCurrency,
        date,
        splits: buildEqualSplits(parsedAmount, splitWith),
      });
      onCreated();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create expense';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-[10px] border border-[var(--neutral-30)] bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--neutral-100)]">
            Add Expense
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-[var(--neutral-60)] hover:bg-[var(--neutral-20)]"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CategoryPicker value={category} onChange={setCategory} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--neutral-70)]">
              Amount ({defaultCurrency})
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-[10px] border-[var(--neutral-30)]"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--neutral-70)]">
              Description
            </label>
            <Input
              type="text"
              placeholder="What was this expense for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-[10px] border-[var(--neutral-30)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--neutral-70)]">
                Date
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-[10px] border-[var(--neutral-30)]"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--neutral-70)]">
                Paid by
              </label>
              <Select value={paidById} onValueChange={setPaidById}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName ?? m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SplitMemberPicker
            members={members}
            selected={splitWith}
            onToggle={toggleSplitMember}
            amount={amount}
            currency={defaultCurrency}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-[4px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-[4px] bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)]"
            >
              {isSubmitting ? 'Adding...' : 'Add Expense'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ExpenseListItem({
  expense,
  currency,
  onDelete,
}: {
  expense: Expense;
  currency: string;
  onDelete: (id: string) => void;
}) {
  const config = CATEGORY_CONFIG[expense.category];
  const Icon = config.icon;
  const settledCount = expense.splits.filter((s) => s.isSettled).length;
  const totalSplits = expense.splits.length;
  const allSettled = totalSplits > 0 && settledCount === totalSplits;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="group flex items-center gap-3 rounded-lg border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-3 transition-colors hover:border-[var(--neutral-40)]"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.bg}`}
      >
        <Icon size={18} weight="duotone" className={config.color} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-[var(--neutral-100)]">
            {expense.description ?? config.label}
          </span>
          <Badge
            variant="secondary"
            className={`${config.bg} ${config.color} shrink-0 px-1.5 py-0 text-[10px] font-medium`}
          >
            {config.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--neutral-60)]">
          <span>{format(new Date(expense.date), 'MMM d, yyyy')}</span>
          <span>&middot;</span>
          <span>Paid by {expense.paidBy.displayName ?? expense.paidBy.name}</span>
          {totalSplits > 0 && (
            <>
              <span>&middot;</span>
              <span
                className={allSettled ? 'text-green-600' : ''}
              >
                {allSettled
                  ? 'All settled'
                  : `${settledCount}/${totalSplits} settled`}
              </span>
            </>
          )}
        </div>
      </div>

      <span className="shrink-0 text-sm font-semibold text-[var(--neutral-100)]">
        {formatAmount(expense.amount, currency)}
      </span>

      <button
        onClick={() => onDelete(expense.id)}
        className="shrink-0 rounded-full p-1.5 text-[var(--neutral-50)] opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
        aria-label="Delete expense"
      >
        <Trash size={14} />
      </button>
    </motion.div>
  );
}

function BalanceCard({
  balance,
  tripId,
  currentUserId,
  onSettled,
}: {
  balance: Balance;
  tripId: string;
  currentUserId: string;
  onSettled: () => void;
}) {
  const [isSettling, setIsSettling] = useState(false);
  const canSettle = balance.fromUserId === currentUserId;

  async function handleSettle() {
    setIsSettling(true);
    try {
      await expenseService.settleAllBetween(
        tripId,
        balance.fromUserId,
        balance.toUserId
      );
      onSettled();
    } catch (err) {
      console.error('Failed to settle:', err);
    } finally {
      setIsSettling(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 rounded-lg border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-3"
    >
      <ArrowsLeftRight
        size={18}
        weight="duotone"
        className="shrink-0 text-[var(--neutral-50)]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm text-[var(--neutral-100)]">
          <strong>{balance.fromUserName}</strong> owes{' '}
          <strong>{balance.toUserName}</strong>
        </span>
        <span className="text-xs text-[var(--neutral-60)]">
          {formatAmount(balance.amount, balance.currency)}
        </span>
      </div>
      {canSettle && (
        <Button
          size="sm"
          variant="outline"
          disabled={isSettling}
          onClick={handleSettle}
          className="shrink-0 rounded-[4px] text-xs"
        >
          {isSettling ? 'Settling...' : 'Settle'}
        </Button>
      )}
    </motion.div>
  );
}

function SummaryCards({
  summary,
  currency,
}: {
  summary: ExpenseSummary | null;
  currency: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col gap-2 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-5 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-surface)]">
          <CurrencyDollar
            size={20}
            weight="duotone"
            className="text-[var(--primary-main)]"
          />
        </div>
        <span className="text-2xl font-semibold text-[var(--neutral-100)]">
          {formatAmount(summary?.totalSpent ?? 0, currency)}
        </span>
        <span className="text-xs text-[var(--neutral-60)]">
          Total Spent ({summary?.expenseCount ?? 0} expenses)
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex flex-col gap-2 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-5 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-surface)]">
          <ChartPie
            size={20}
            weight="duotone"
            className="text-[var(--primary-main)]"
          />
        </div>
        <CategoryBar
          breakdown={summary?.categoryBreakdown ?? []}
          currency={currency}
        />
        <span className="text-xs text-[var(--neutral-60)]">
          By Category
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex flex-col gap-2 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-5 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-surface)]">
          <Users
            size={20}
            weight="duotone"
            className="text-[var(--primary-main)]"
          />
        </div>
        <div className="flex flex-col gap-1">
          {summary?.memberBreakdown.slice(0, 3).map((mb) => (
            <div
              key={mb.userId}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-[var(--neutral-70)]">
                {mb.user.displayName ?? mb.user.name}
              </span>
              <span
                className={`font-medium ${mb.netBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}
              >
                {mb.netBalance >= 0 ? '+' : ''}
                {formatAmount(mb.netBalance, currency)}
              </span>
            </div>
          ))}
        </div>
        <span className="text-xs text-[var(--neutral-60)]">
          Member Balances
        </span>
      </motion.div>
    </div>
  );
}

function CategoryFilter({
  activeFilter,
  onFilterChange,
}: {
  activeFilter: ExpenseCategory | 'ALL';
  onFilterChange: (filter: ExpenseCategory | 'ALL') => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.25 }}
      className="flex items-center gap-2 overflow-x-auto"
    >
      <Funnel
        size={14}
        className="shrink-0 text-[var(--neutral-50)]"
      />
      <button
        onClick={() => onFilterChange('ALL')}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          activeFilter === 'ALL'
            ? 'bg-[var(--primary-main)] text-white'
            : 'bg-[var(--neutral-20)] text-[var(--neutral-60)] hover:bg-[var(--neutral-30)]'
        }`}
      >
        All
      </button>
      {CATEGORIES.map((cat) => {
        const config = CATEGORY_CONFIG[cat];
        return (
          <button
            key={cat}
            onClick={() => onFilterChange(cat)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeFilter === cat
                ? 'bg-[var(--primary-main)] text-white'
                : 'bg-[var(--neutral-20)] text-[var(--neutral-60)] hover:bg-[var(--neutral-30)]'
            }`}
          >
            {config.label}
          </button>
        );
      })}
    </motion.div>
  );
}

function ExpenseListSection({
  expenses,
  activeFilter,
  currency,
  onDelete,
}: {
  expenses: Expense[];
  activeFilter: ExpenseCategory | 'ALL';
  currency: string;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.3 }}
      className="rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-6 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
    >
      <h3 className="mb-4 text-base font-medium text-[var(--neutral-100)]">
        Expenses
      </h3>

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary-surface)]">
            <CurrencyDollar
              size={28}
              weight="duotone"
              className="text-[var(--primary-main)]"
            />
          </div>
          <p className="text-sm text-[var(--neutral-60)]">
            {activeFilter === 'ALL'
              ? 'No expenses yet. Add your first one!'
              : `No ${CATEGORY_CONFIG[activeFilter].label.toLowerCase()} expenses`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {expenses.map((expense) => (
              <ExpenseListItem
                key={expense.id}
                expense={expense}
                currency={currency}
                onDelete={onDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

function SettleUpSection({
  balances,
  tripId,
  currentUserId,
  onSettled,
}: {
  balances: Balance[];
  tripId: string;
  currentUserId: string;
  onSettled: () => void;
}) {
  if (balances.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.35 }}
      className="rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-6 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
    >
      <div className="mb-4 flex items-center gap-2">
        <ArrowsLeftRight
          size={20}
          weight="duotone"
          className="text-[var(--primary-main)]"
        />
        <h3 className="text-base font-medium text-[var(--neutral-100)]">
          Settle Up
        </h3>
      </div>

      <div className="flex flex-col gap-2">
        {balances.map((balance) => (
          <BalanceCard
            key={`${balance.fromUserId}-${balance.toUserId}`}
            balance={balance}
            tripId={tripId}
            currentUserId={currentUserId}
            onSettled={onSettled}
          />
        ))}
      </div>
    </motion.div>
  );
}

interface TripMemberRaw {
  User?: {
    id: string;
    name: string;
    displayName?: string;
    avatarUrl: string | null;
  };
}

function extractMembers(
  tripMembers: unknown[],
  ownerId: string
): TripMember[] {
  const owner: TripMember = {
    id: ownerId,
    name: 'Owner',
    avatarUrl: null,
  };
  const others: TripMember[] = [];

  for (const raw of tripMembers) {
    const m = raw as TripMemberRaw;
    if (!m.User) continue;

    if (m.User.id === ownerId) {
      owner.name = m.User.name;
      owner.displayName = m.User.displayName;
      owner.avatarUrl = m.User.avatarUrl;
    } else {
      others.push({
        id: m.User.id,
        name: m.User.name,
        displayName: m.User.displayName,
        avatarUrl: m.User.avatarUrl,
      });
    }
  }

  return [owner, ...others];
}

function useTripExpenseData(tripId: string) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [tripTitle, setTripTitle] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [expResult, summaryResult, balanceResult, trip] =
        await Promise.all([
          expenseService.listExpenses(tripId, { limit: 100 }),
          expenseService.getSummary(tripId),
          expenseService.getBalances(tripId),
          tripService.getTrip(tripId),
        ]);

      setExpenses(expResult.expenses);
      setSummary(summaryResult);
      setBalances(balanceResult);
      setTripTitle(trip.title);
      setDefaultCurrency(
        trip.budgetCurrency ?? summaryResult.currency ?? 'USD'
      );

      const rawMembers =
        trip.trip_members && Array.isArray(trip.trip_members)
          ? trip.trip_members
          : [];
      setMembers(extractMembers(rawMembers, trip.ownerId));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    expenses,
    summary,
    balances,
    members,
    tripTitle,
    defaultCurrency,
    isLoading,
    error,
    fetchData,
  };
}

function PageToolbar({
  onBack,
  onAdd,
  tripTitle,
}: {
  onBack: () => void;
  onAdd: () => void;
  tripTitle: string;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[var(--neutral-60)] transition-colors hover:text-[var(--neutral-100)]"
        >
          <ArrowLeft size={16} />
          Back to Budget
        </button>
        <Button
          onClick={onAdd}
          className="rounded-[4px] bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)]"
        >
          <Plus size={16} weight="bold" />
          Add Expense
        </Button>
      </div>
      {tripTitle && (
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-lg font-semibold text-[var(--neutral-100)]"
        >
          {tripTitle}
        </motion.h2>
      )}
    </>
  );
}

function TripExpenseContent() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?.id ?? '';

  const {
    expenses,
    summary,
    balances,
    members,
    tripTitle,
    defaultCurrency,
    isLoading,
    error,
    fetchData,
  } = useTripExpenseData(tripId);

  const [activeFilter, setActiveFilter] = useState<
    ExpenseCategory | 'ALL'
  >('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredExpenses = useMemo(
    () =>
      activeFilter === 'ALL'
        ? expenses
        : expenses.filter((e) => e.category === activeFilter),
    [expenses, activeFilter]
  );

  async function handleDelete(expenseId: string) {
    try {
      await expenseService.deleteExpense(expenseId);
      fetchData();
    } catch (err) {
      console.error('Failed to delete expense:', err);
    }
  }

  if (isLoading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-20">
        <p className="text-sm text-red-600">{error}</p>
        <Button
          onClick={fetchData}
          className="rounded-[4px] bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)]"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <PageToolbar
          onBack={() => router.push('/budget')}
          onAdd={() => setShowAddModal(true)}
          tripTitle={tripTitle}
        />
        <SummaryCards summary={summary} currency={defaultCurrency} />
        <CategoryFilter
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
        <ExpenseListSection
          expenses={filteredExpenses}
          activeFilter={activeFilter}
          currency={defaultCurrency}
          onDelete={handleDelete}
        />
        <SettleUpSection
          balances={balances}
          tripId={tripId}
          currentUserId={currentUserId}
          onSettled={fetchData}
        />

        <AnimatePresence>
          {showAddModal && (
            <AddExpenseModal
              tripId={tripId}
              members={members}
              currentUserId={currentUserId}
              defaultCurrency={defaultCurrency}
              onClose={() => setShowAddModal(false)}
              onCreated={fetchData}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function TripExpensePage() {
  return <TripExpenseContent />;
}
