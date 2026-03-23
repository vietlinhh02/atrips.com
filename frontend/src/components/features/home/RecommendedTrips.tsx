'use client';

import { useRouter } from 'next/navigation';
import { ArrowElbowDownRight } from '@phosphor-icons/react';
import DestinationCard from '@/src/components/common/cards/DestinationCard';
import useChatStore from '@/src/stores/chatStore';

const destinations = [
  {
    title: 'Bali - Indonesia',
    description: 'Tropical paradise with stunning temples and rice terraces.',
    priceRange: '$500 - $800',
    dateRange: 'Apr - Oct',
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
  },
  {
    title: 'Kyoto - Japan',
    description: 'Cherry blossoms, ancient temples, and serene gardens.',
    priceRange: '$800 - $1,200',
    dateRange: 'Mar - May',
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600',
  },
  {
    title: 'Paris - France',
    description: 'Iconic landmarks, world-class cuisine, and art museums.',
    priceRange: '$1,000 - $1,500',
    dateRange: 'Apr - Jun',
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600',
  },
  {
    title: 'Bangkok - Thailand',
    description: 'Vibrant street food, golden temples, and floating markets.',
    priceRange: '$400 - $700',
    dateRange: 'Nov - Mar',
    image: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600',
  },
];

export default function RecommendedTrips() {
  const router = useRouter();
  const createConversation = useChatStore((s) => s.createConversation);

  const handlePlanTrip = async (title: string) => {
    const id = await createConversation(undefined, `Plan a trip to ${title}`);
    if (id) {
      router.push(`/chat/${id}?q=${encodeURIComponent(`Plan a trip to ${title}`)}`);
    }
  };

  return (
    <section className="relative z-10 w-full max-w-[1320px] mx-auto px-4 md:px-6 py-8 md:py-16 flex flex-col gap-6">
      <div className="flex items-end justify-between border-b border-[var(--neutral-30)] pb-4">
        <div>
          <h2 className="text-[20px] md:text-[24px] font-medium leading-[1.2] text-[var(--neutral-100)] font-sans">
            Recommended Trips for You
          </h2>
          <p className="text-[14px] text-[var(--neutral-60)] mt-1">Curated destinations based on your interests.</p>
        </div>
        <button
          onClick={() => router.push('/explore')}
          className="text-[14px] md:text-[16px] leading-[1.5] text-[var(--primary-main)] hover:text-[var(--primary-hover)] font-medium font-sans flex items-center gap-1 transition-colors"
        >
          See More
          <ArrowElbowDownRight size={16} />
        </button>
      </div>

      <div className="flex overflow-x-auto pb-6 gap-6 snap-x snap-mandatory hide-scrollbar md:grid md:grid-cols-4 md:overflow-visible md:snap-none md:pb-0">
        {destinations.map((dest, index) => (
          <div key={index} className="min-w-[280px] md:min-w-0 snap-center hover:-translate-y-1 transition-transform duration-300">
            <DestinationCard
              {...dest}
              onAction={() => handlePlanTrip(dest.title)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
