'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown,
  Check,
  X,
  Lightning,
  CreditCard,
  CaretDown,
  Spinner,
  Airplane,
  ChatCircle,
} from '@phosphor-icons/react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { useToast } from '@/src/components/ui/use-toast';
import useAuthStore from '@/src/stores/authStore';
import userService from '@/src/services/userService';
import type { UserSubscription } from '@/src/services/userService';

type Tier = 'FREE' | 'PRO' | 'BUSINESS';

interface PlanFeature {
  label: string;
  free: string | boolean;
  pro: string | boolean;
  business: string | boolean;
}

interface PlanTier {
  tier: Tier;
  name: string;
  price: string;
  period: string;
  description: string;
  highlighted: boolean;
  badge: string | null;
}

interface FaqItem {
  question: string;
  answer: string;
}

const PLAN_TIERS: PlanTier[] = [
  {
    tier: 'FREE',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Get started with basic trip planning.',
    highlighted: false,
    badge: null,
  },
  {
    tier: 'PRO',
    name: 'Pro',
    price: '$9.99',
    period: '/mo',
    description: 'For frequent travelers who want more power.',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    tier: 'BUSINESS',
    name: 'Business',
    price: '$29.99',
    period: '/mo',
    description: 'For teams and travel professionals.',
    highlighted: false,
    badge: null,
  },
];

const PLAN_FEATURES: PlanFeature[] = [
  {
    label: 'AI Conversations',
    free: '10/month',
    pro: '100/month',
    business: 'Unlimited',
  },
  {
    label: 'Trip Plans',
    free: '3',
    pro: '20',
    business: 'Unlimited',
  },
  {
    label: 'Tools',
    free: 'Basic search',
    pro: 'All tools',
    business: 'All tools + priority',
  },
  {
    label: 'Calendar Export (ICS)',
    free: false,
    pro: true,
    business: true,
  },
  {
    label: 'PDF Export',
    free: false,
    pro: false,
    business: true,
  },
  {
    label: 'Share Links',
    free: false,
    pro: true,
    business: true,
  },
  {
    label: 'Team Collaboration',
    free: false,
    pro: false,
    business: true,
  },
  {
    label: 'Support',
    free: 'Community',
    pro: 'Email',
    business: 'Priority',
  },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Can I change my plan at any time?',
    answer:
      'Yes, you can upgrade or downgrade your plan at any time. When upgrading, you will be charged the prorated difference for the remainder of your billing cycle. Downgrades take effect at the end of the current billing period.',
  },
  {
    question: 'What happens when I reach my AI conversation limit?',
    answer:
      'When you reach your monthly AI conversation limit, you will not be able to start new AI-assisted planning sessions until your quota resets at the beginning of the next billing cycle. You can upgrade your plan for more conversations.',
  },
  {
    question: 'Is there a free trial for paid plans?',
    answer:
      'New users start with a 7-day trial of Pro features when they sign up. After the trial ends, you can continue on the Free plan or upgrade to keep access to advanced features.',
  },
  {
    question: 'How do I cancel my subscription?',
    answer:
      'You can cancel your subscription at any time from your account settings. Your access to paid features will continue until the end of your current billing period. No refunds are issued for partial months.',
  },
];

const TIER_ORDER: Record<Tier, number> = {
  FREE: 0,
  PRO: 1,
  BUSINESS: 2,
};

function tierIcon(tier: Tier) {
  switch (tier) {
    case 'FREE':
      return <Lightning size={20} weight="duotone" />;
    case 'PRO':
      return <Crown size={20} weight="duotone" />;
    case 'BUSINESS':
      return <CreditCard size={20} weight="duotone" />;
  }
}

function FeatureValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <Check
        size={18}
        weight="bold"
        className="text-green-600"
      />
    );
  }
  if (value === false) {
    return (
      <X
        size={18}
        weight="bold"
        className="text-neutral-400"
      />
    );
  }
  return (
    <span className="text-sm text-[var(--neutral-70)]">{value}</span>
  );
}

function UsageStat({
  icon,
  label,
  used,
  limit,
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number;
}) {
  const isUnlimited = limit === -1 || limit >= 999999;
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const remaining = isUnlimited ? Infinity : Math.max(limit - used, 0);
  const isNearLimit = !isUnlimited && percentage >= 80;

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-lg bg-[var(--primary-surface)] p-2 text-[var(--primary-main)]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-[var(--neutral-100)]">
            {label}
          </span>
          <span className="text-xs text-[var(--neutral-60)]">
            {used} / {isUnlimited ? 'Unlimited' : limit}
          </span>
        </div>
        {!isUnlimited && (
          <div className="h-1.5 w-full rounded-full bg-[var(--neutral-30)]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isNearLimit
                  ? 'bg-amber-500'
                  : 'bg-[var(--primary-main)]'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
        <p className="mt-1 text-xs text-[var(--neutral-60)]">
          {isUnlimited
            ? 'Unlimited usage'
            : `${remaining} remaining this month`}
          {isNearLimit && (
            <span className="text-amber-600 font-medium">
              {' '}-- Consider upgrading
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function FaqAccordionItem({ item }: { item: FaqItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-[var(--neutral-30)] last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-4 text-left transition-colors hover:text-[var(--primary-main)]"
      >
        <span className="text-sm font-medium text-[var(--neutral-100)] pr-4">
          {item.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <CaretDown
            size={16}
            className="shrink-0 text-[var(--neutral-60)]"
          />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-sm text-[var(--neutral-60)] leading-relaxed">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PricingCard({
  plan,
  currentTier,
  onUpgrade,
  isUpgrading,
}: {
  plan: PlanTier;
  currentTier: Tier;
  onUpgrade: (tier: Tier) => void;
  isUpgrading: boolean;
}) {
  const isCurrent = plan.tier === currentTier;
  const isUpgrade = TIER_ORDER[plan.tier] > TIER_ORDER[currentTier];
  const isDowngrade = TIER_ORDER[plan.tier] < TIER_ORDER[currentTier];

  let cardClass =
    'relative flex flex-col rounded-2xl border p-6 transition-shadow';
  if (plan.highlighted) {
    cardClass +=
      ' border-[var(--primary-main)] shadow-lg ring-1 ring-[var(--primary-main)]/20';
  } else if (plan.tier === 'BUSINESS') {
    cardClass +=
      ' border-[var(--neutral-40)] bg-gradient-to-br from-[var(--neutral-20)] to-white';
  } else {
    cardClass += ' border-[var(--neutral-30)]';
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cardClass}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-[var(--primary-main)] text-white px-3 py-0.5 text-xs">
            {plan.badge}
          </Badge>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          {tierIcon(plan.tier)}
          <h3 className="text-lg font-semibold text-[var(--neutral-100)]">
            {plan.name}
          </h3>
          {isCurrent && (
            <Badge variant="outline" className="text-xs ml-auto">
              Current Plan
            </Badge>
          )}
        </div>
        <p className="text-sm text-[var(--neutral-60)]">
          {plan.description}
        </p>
      </div>

      <div className="mb-6">
        <span className="text-3xl font-bold text-[var(--neutral-100)]">
          {plan.price}
        </span>
        <span className="text-sm text-[var(--neutral-60)]">
          {plan.period}
        </span>
      </div>

      <ul className="mb-6 flex-1 space-y-3">
        {PLAN_FEATURES.map((feature) => {
          const tierKey = plan.tier.toLowerCase() as
            | 'free'
            | 'pro'
            | 'business';
          const value = feature[tierKey];
          return (
            <li key={feature.label} className="flex items-center gap-2">
              <FeatureValue value={value} />
              <span className="text-sm text-[var(--neutral-70)]">
                {feature.label}
                {typeof value === 'string' && (
                  <span className="text-[var(--neutral-60)]">
                    {' '}({value})
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto">
        {isCurrent ? (
          <Button
            variant="outline"
            className="w-full"
            disabled
          >
            Current Plan
          </Button>
        ) : isUpgrade ? (
          <Button
            className={`w-full ${
              plan.highlighted
                ? 'bg-[var(--primary-main)] hover:bg-[var(--primary-hover)] text-white'
                : ''
            }`}
            onClick={() => onUpgrade(plan.tier)}
            disabled={isUpgrading}
          >
            {isUpgrading ? (
              <>
                <Spinner size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Lightning size={16} weight="fill" />
                Upgrade to {plan.name}
              </>
            )}
          </Button>
        ) : isDowngrade ? (
          <Button
            variant="outline"
            className="w-full"
            disabled
          >
            Downgrade
          </Button>
        ) : null}
      </div>
    </motion.div>
  );
}

function SubscriptionContent() {
  const { subscription: storeSubscription } = useAuthStore();
  const toast = useToast();

  const [subscription, setSubscription] =
    useState<UserSubscription | null>(storeSubscription);
  const [isLoading, setIsLoading] = useState(true);
  const [upgradingTier, setUpgradingTier] = useState<Tier | null>(null);

  useEffect(() => {
    async function loadSubscription() {
      try {
        const data = await userService.getSubscription();
        setSubscription(data);
      } catch {
        if (storeSubscription) {
          setSubscription(storeSubscription);
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadSubscription();
  }, [storeSubscription]);

  async function handleUpgrade(tier: Tier) {
    if (tier === 'FREE') return;

    setUpgradingTier(tier);
    try {
      const session = await userService.createCheckoutSession(
        tier as 'PRO' | 'BUSINESS'
      );
      if (session?.url) {
        window.location.href = session.url;
      }
    } catch {
      toast.info(
        'Coming soon',
        'Subscription upgrades will be available shortly.'
      );
    } finally {
      setUpgradingTier(null);
    }
  }

  const currentTier: Tier = subscription?.tier ?? 'FREE';

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner size={32} className="animate-spin text-[var(--primary-main)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Current Plan Section */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-10"
      >
        <h2 className="mb-4 text-lg font-semibold text-[var(--neutral-100)]">
          Current Plan
        </h2>
        <div className="rounded-2xl border border-[var(--neutral-30)] bg-white p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[var(--primary-surface)] p-3 text-[var(--primary-main)]">
                {tierIcon(currentTier)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-[var(--neutral-100)]">
                    {PLAN_TIERS.find((p) => p.tier === currentTier)?.name} Plan
                  </h3>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      subscription?.status === 'ACTIVE' || subscription?.status === 'TRIAL'
                        ? 'border-green-300 text-green-700 bg-green-50'
                        : 'border-amber-300 text-amber-700 bg-amber-50'
                    }`}
                  >
                    {subscription?.status ?? 'ACTIVE'}
                  </Badge>
                </div>
                {subscription?.currentPeriodEnd && (
                  <p className="mt-0.5 text-xs text-[var(--neutral-60)]">
                    Renews{' '}
                    {new Date(
                      subscription.currentPeriodEnd
                    ).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>

            {subscription?.usage && (
              <div className="flex flex-col gap-4 sm:min-w-[280px]">
                <UsageStat
                  icon={<ChatCircle size={18} weight="duotone" />}
                  label="AI Conversations"
                  used={subscription.usage?.aiQuota?.used ?? 0}
                  limit={subscription.usage?.aiQuota?.limit ?? 10}
                />
                <UsageStat
                  icon={<Airplane size={18} weight="duotone" />}
                  label="Trip Plans"
                  used={subscription.usage?.trips?.created ?? 0}
                  limit={subscription.usage?.trips?.limit ?? 3}
                />
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* Pricing Cards Section */}
      <section className="mb-10">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-[var(--neutral-100)]">
            Choose Your Plan
          </h2>
          <p className="mt-1 text-sm text-[var(--neutral-60)]">
            Pick the plan that fits your travel planning needs.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLAN_TIERS.map((plan, i) => (
            <motion.div
              key={plan.tier}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <PricingCard
                plan={plan}
                currentTier={currentTier}
                onUpgrade={handleUpgrade}
                isUpgrading={upgradingTier === plan.tier}
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <h2 className="mb-4 text-lg font-semibold text-[var(--neutral-100)]">
          Frequently Asked Questions
        </h2>
        <div className="rounded-2xl border border-[var(--neutral-30)] bg-white px-6">
          {FAQ_ITEMS.map((item) => (
            <FaqAccordionItem key={item.question} item={item} />
          ))}
        </div>
      </motion.section>
    </div>
  );
}

export default function SubscriptionPage() {
  return <SubscriptionContent />;
}
