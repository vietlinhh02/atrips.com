'use client';

import HeroSection from '@/src/components/features/home/HeroSection';
import WeatherBanner from '@/src/components/features/home/WeatherBanner';
import RecommendedTrips from '@/src/components/features/home/RecommendedTrips';
import WhyChooseUs from '@/src/components/features/home/WhyChooseUs';
import CallToAction from '@/src/components/features/home/CallToAction';
import Footer from '@/src/components/features/home/Footer';

export default function Home() {
  return (
    <>
      {/* Global Gradient Background */}
      <div className="absolute inset-0 z-[-3] bg-gradient-to-b from-white via-[#F2F8FD]/60 to-white dark:from-[var(--neutral-10)] dark:via-[var(--primary-surface)]/40 dark:to-[var(--neutral-10)] min-h-full" />

      {/* Hero Section */}
      <HeroSection />

      {/* Weather Banner */}
      <WeatherBanner />

      {/* Recommended Trips Section */}
      <RecommendedTrips />

      {/* Why Choose Us Section */}
      <WhyChooseUs />

      {/* CTA Section */}
      <CallToAction />

      {/* Footer */}
      <Footer />
    </>
  );
}
