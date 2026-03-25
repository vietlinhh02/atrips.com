'use client';

import {
  Trophy,
  Medal,
  Flag,
  Lightning,
} from '@phosphor-icons/react';
import ComingSoon from '@/src/components/features/common/ComingSoon';

export default function AchievementsPage() {
  return (
    <ComingSoon
      icon={<Trophy size={20} weight="fill" />}
      title="Achievements"
      subtitle="Track your travel milestones and earn rewards"
      bannerHeading="Level up your travels"
      bannerDescription="Earn badges for visiting new countries, completing trip plans, and sharing experiences. Compete with friends and unlock exclusive travel perks."
      features={[
        {
          icon: <Medal size={24} weight="duotone" />,
          title: 'Earn Badges',
          description: 'Unlock achievements for every travel milestone',
          accentColor: 'text-amber-500',
          bgColor: 'bg-amber-50 dark:bg-amber-950/40',
        },
        {
          icon: <Flag size={24} weight="duotone" />,
          title: 'Country Tracker',
          description: 'Track countries and cities you have visited',
          accentColor: 'text-emerald-500',
          bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
        },
        {
          icon: <Lightning size={24} weight="duotone" />,
          title: 'Leaderboard',
          description: 'See how you rank among fellow travelers',
          accentColor: 'text-purple-500',
          bgColor: 'bg-purple-50 dark:bg-purple-950/40',
        },
      ]}
    />
  );
}
