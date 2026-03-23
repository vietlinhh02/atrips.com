import AuthHeroSection from '@/src/components/common/layout/AuthHeroSection';

const heroSlides = [
  {
    imageUrl: '/front/auth/login-hero.jpg',
    title: 'From Dream Destinations to Real Experiences',
    description: 'Your next adventure starts with TripMind.',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800',
    title: 'Explore the World with Confidence',
    description: 'Let us guide you to unforgettable destinations.',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1',
    title: 'Your Journey, Perfectly Planned',
    description: 'Tailored travel experiences just for you.',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828',
    title: 'Adventure Awaits Around Every Corner',
    description: 'Discover hidden gems and create lasting memories.',
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full h-dvh bg-white overflow-hidden">
      <div className="grid w-full h-full lg:grid-cols-2">
        <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-[80px] lg:py-12 h-full overflow-y-auto">
          <div className="flex min-h-full w-full items-center justify-center">
            <div className="w-full max-w-[620px] lg:max-w-none">
              {children}
            </div>
          </div>
        </div>
        <AuthHeroSection slides={heroSlides} autoPlayInterval={5000} />
      </div>
    </div>
  );
}
