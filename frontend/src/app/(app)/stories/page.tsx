import {
  PencilLine,
  BookOpen,
  Camera,
  ChatCircle,
} from '@phosphor-icons/react';
import ComingSoon from '@/src/components/features/common/ComingSoon';

export default function StoriesPage() {
  return (
    <ComingSoon
      icon={<BookOpen size={20} weight="fill" />}
      title="Travel Stories"
      subtitle="Share experiences and discover inspiring travel tales"
      bannerHeading="Every trip has a story"
      bannerDescription="Write about your adventures, share tips with fellow travelers, and read authentic travel stories from around the world. Your next destination awaits."
      features={[
        {
          icon: <PencilLine size={24} weight="duotone" />,
          title: 'Write Stories',
          description: 'Share your travel experiences with rich text and photos',
          accentColor: 'text-indigo-500',
          bgColor: 'bg-indigo-50 dark:bg-indigo-950/40',
        },
        {
          icon: <Camera size={24} weight="duotone" />,
          title: 'Photo Journals',
          description: 'Create visual diaries of your trips with captions',
          accentColor: 'text-amber-500',
          bgColor: 'bg-amber-50 dark:bg-amber-950/40',
        },
        {
          icon: <ChatCircle size={24} weight="duotone" />,
          title: 'Community',
          description: 'Comment, like, and connect with storytellers',
          accentColor: 'text-teal-500',
          bgColor: 'bg-teal-50 dark:bg-teal-950/40',
        },
      ]}
      previewCards={[
        { title: '7 Days Across Vietnam', subtitle: 'by @wanderlust', imageUrl: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600&q=80', location: 'Hanoi, Vietnam' },
        { title: 'A Week in Santorini', subtitle: 'by @travel_diary', imageUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600&q=80', location: 'Santorini, Greece' },
        { title: 'Backpacking Thailand', subtitle: 'by @nomad_life', imageUrl: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=600&q=80', location: 'Bangkok, Thailand' },
        { title: 'Swiss Alps Hiking', subtitle: 'by @mountain_lover', imageUrl: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&q=80', location: 'Zermatt, Switzerland' },
      ]}
    />
  );
}
