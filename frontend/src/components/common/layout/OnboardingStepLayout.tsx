'use client';

import { useRouter } from 'next/navigation';
import BrandHeader from '../brand/BrandHeader';
import AuthHeroSection from './AuthHeroSection';
import useAuthStore from '@/src/stores/authStore';

interface OnboardingStepLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  totalSteps?: number;
  onBack?: () => void;
  showBack?: boolean;
}

const onboardingSlides = [
  {
    imageUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200',
    title: 'Start Shaping Your Adventure',
    description: 'The more we know, the better we guide.',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200',
    title: 'Designed Around Your Dreams',
    description: 'Tailor-made trips start with your preferences.',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200',
    title: 'Discover Your Travel Personality',
    description: 'Every traveler is unique, and so is your journey.',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1527004013197-933c4bb611b3?w=1200',
    title: 'Your Perfect Journey Awaits',
    description: 'Personalized recommendations based on your profile.',
  },
];

export default function OnboardingStepLayout({
  children,
  currentStep,
  totalSteps = 4,
  onBack,
  showBack = true,
}: OnboardingStepLayoutProps) {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="w-full h-dvh bg-white overflow-hidden">
      <div className="grid w-full h-full lg:grid-cols-2">
        <div className="flex w-full items-center justify-center px-6 py-12 lg:items-start lg:px-[60px] h-full overflow-y-auto">
          <div className="w-full max-w-[620px] lg:max-w-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {showBack && onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 text-sm text-[var(--neutral-100)]"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M10 12L6 8L10 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Back
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalSteps }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-[6px] w-[40px] rounded-full ${
                        index < currentStep
                          ? 'bg-[var(--neutral-90,#242424)]'
                          : 'bg-[var(--neutral-40)]'
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm text-[var(--neutral-60)] hover:text-[var(--neutral-100)] transition"
                >
                  Logout
                </button>
              </div>
            </div>

            <div className="mt-16 flex flex-col gap-[40px]">
              <BrandHeader logoSize="large" />
              {children}
            </div>
          </div>
        </div>

        <AuthHeroSection slides={onboardingSlides} autoPlayInterval={6000} />
      </div>
    </div>
  );
}
