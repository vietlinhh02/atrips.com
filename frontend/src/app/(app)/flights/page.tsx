import {
  AirplaneTilt,
  AirplaneTakeoff,
  Bell,
  Clock,
} from '@phosphor-icons/react';
import ComingSoon from '@/src/components/features/common/ComingSoon';

export default function FlightsPage() {
  return (
    <ComingSoon
      icon={<AirplaneTilt size={20} weight="fill" />}
      title="Flight Tracker"
      subtitle="Track flights in real-time and manage your bookings"
      bannerHeading="Your flights, all in one place"
      bannerDescription="Track live flight status, get delay notifications, compare prices, and manage all your flight bookings seamlessly within your trip plans."
      features={[
        {
          icon: <AirplaneTakeoff size={24} weight="duotone" />,
          title: 'Live Tracking',
          description: 'Real-time flight status with gate and delay updates',
          accentColor: 'text-sky-500',
          bgColor: 'bg-sky-50 dark:bg-sky-950/40',
        },
        {
          icon: <Bell size={24} weight="duotone" />,
          title: 'Smart Alerts',
          description: 'Get notified about delays, gate changes, and cancellations',
          accentColor: 'text-amber-500',
          bgColor: 'bg-amber-50 dark:bg-amber-950/40',
        },
        {
          icon: <Clock size={24} weight="duotone" />,
          title: 'Trip Sync',
          description: 'Auto-sync flights with your trip itinerary timeline',
          accentColor: 'text-green-500',
          bgColor: 'bg-green-50 dark:bg-green-950/40',
        },
      ]}
    />
  );
}
