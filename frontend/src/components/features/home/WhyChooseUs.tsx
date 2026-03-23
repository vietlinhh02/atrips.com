'use client';

import { Brain, CalendarCheck, Users, MapTrifold } from '@phosphor-icons/react';

const features = [
  {
    icon: Brain,
    title: 'AI Trip Planning',
    description: 'Our advanced AI creates personalized itineraries based on your preferences and budget.',
  },
  {
    icon: CalendarCheck,
    title: 'Seamless Booking',
    description: 'Book flights, hotels, and activities all in one place with our integrated booking system.',
  },
  {
    icon: Users,
    title: 'Community Reviews',
    description: 'Get authentic recommendations from a community of passionate travelers.',
  },
  {
    icon: MapTrifold,
    title: 'Interactive Maps',
    description: 'Navigate your destination like a local with our detailed, interactive maps.',
  },
];

export default function WhyChooseUs() {
  return (
    <section className="relative z-10 w-full bg-[#FAFAFA] dark:bg-[var(--neutral-20)] py-16 md:py-24 border-y border-[var(--neutral-30)]">
      <div className="max-w-[1320px] mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-[24px] md:text-[32px] font-medium text-[var(--neutral-100)] mb-4 font-sans">
            Why Travel with <span className="font-logo">Atrips</span>?
          </h2>
          <p className="text-[var(--neutral-60)] max-w-2xl mx-auto">
            Experience a new era of travel planning with our cutting-edge features designed to make your journey unforgettable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white dark:bg-[var(--neutral-10)] p-6 rounded-[12px] border border-[var(--neutral-30)] hover:shadow-lg dark:hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)] transition-shadow duration-300 flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 bg-[var(--primary-main)]/10 rounded-full flex items-center justify-center mb-4 text-[var(--primary-main)]">
                <feature.icon size={24} weight="fill" />
              </div>
              <h3 className="text-[18px] font-medium text-[var(--neutral-100)] mb-2">{feature.title}</h3>
              <p className="text-[14px] text-[var(--neutral-60)] leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
