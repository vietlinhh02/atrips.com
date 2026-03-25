import {
  BookmarkSimple,
  FolderSimple,
  Heart,
  ShareNetwork,
} from '@phosphor-icons/react';
import ComingSoon from '@/src/components/features/common/ComingSoon';

export default function CollectionsPage() {
  return (
    <ComingSoon
      icon={<BookmarkSimple size={20} weight="fill" />}
      title="Collections"
      subtitle="Save and organize your favorite places into curated collections"
      bannerHeading="Your personal travel library"
      bannerDescription="Organize restaurants, hotels, attractions, and hidden gems into themed collections. Share them with friends or keep them private for your next adventure."
      features={[
        {
          icon: <FolderSimple size={24} weight="duotone" />,
          title: 'Smart Folders',
          description: 'Auto-organize saved places by destination, category, or trip',
          accentColor: 'text-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-950/40',
        },
        {
          icon: <Heart size={24} weight="duotone" />,
          title: 'Favorites',
          description: 'Quick-save places from any trip plan with one tap',
          accentColor: 'text-rose-500',
          bgColor: 'bg-rose-50 dark:bg-rose-950/40',
        },
        {
          icon: <ShareNetwork size={24} weight="duotone" />,
          title: 'Share Lists',
          description: 'Create collaborative lists with your travel group',
          accentColor: 'text-violet-500',
          bgColor: 'bg-violet-50 dark:bg-violet-950/40',
        },
      ]}
      previewCards={[
        { title: 'Best Cafés in Hội An', subtitle: '12 places saved', imageUrl: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600&q=80', location: 'Hội An, Vietnam' },
        { title: 'Tokyo Street Food', subtitle: '8 places saved', imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80', location: 'Tokyo, Japan' },
        { title: 'Hidden Gems Bali', subtitle: '15 places saved', imageUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80', location: 'Bali, Indonesia' },
        { title: 'Paris Must-Visit', subtitle: '20 places saved', imageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80', location: 'Paris, France' },
      ]}
    />
  );
}
