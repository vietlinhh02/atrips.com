'use client';

import { usePathname, useRouter } from 'next/navigation';
import BrandHeader from '@/src/components/common/brand/BrandHeader';
import AuthHeroSection from '@/src/components/common/layout/AuthHeroSection';
import useAuthStore from '@/src/stores/authStore';

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

const TOTAL_STEPS = 4;

function getStepFromPath(pathname: string): number {
  if (pathname.includes('/result') || pathname.includes('/step-4')) return 4;
  if (pathname.includes('/step-3')) return 3;
  if (pathname.includes('/step-2')) return 2;
  return 1;
}

function getBackPath(step: number): string | null {
  if (step === 2) return '/onboarding/step-1?edit=true';
  if (step === 3) return '/onboarding/step-2?edit=true';
  if (step === 4) return '/onboarding?edit=true&step=3';
  return null;
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const currentStep = getStepFromPath(pathname);
  const backPath = getBackPath(currentStep);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="w-full h-dvh bg-white overflow-hidden">
      <div className="grid w-full h-full lg:grid-cols-2">
        <div className="flex w-full items-start justify-center px-6 py-12 lg:px-[60px] h-full overflow-y-auto">
          <div className="w-full max-w-[620px] lg:max-w-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {backPath && (
                  <button
                    type="button"
                    onClick={() => router.push(backPath)}
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
                  {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
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
