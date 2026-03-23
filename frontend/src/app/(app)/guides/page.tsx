'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Clock,
  MagnifyingGlass,
  User,
} from '@phosphor-icons/react';

type GuideCategory =
  | 'All'
  | 'Getting Started'
  | 'Destinations'
  | 'Budget Tips'
  | 'Culture'
  | 'Food'
  | 'Safety';

interface Guide {
  id: string;
  title: string;
  category: Exclude<GuideCategory, 'All'>;
  description: string;
  readTime: string;
  imageUrl: string;
  content: string[];
}

const CATEGORIES: GuideCategory[] = [
  'All',
  'Getting Started',
  'Destinations',
  'Budget Tips',
  'Culture',
  'Food',
  'Safety',
];

const CATEGORY_COLORS: Record<Exclude<GuideCategory, 'All'>, string> = {
  'Getting Started':
    'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  Destinations:
    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'Budget Tips':
    'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  Culture:
    'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  Food: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  Safety: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

const GUIDES: Guide[] = [
  {
    id: 'plan-with-ai',
    title: 'How to Plan the Perfect Trip with AI',
    category: 'Getting Started',
    description:
      'Learn how to use the Atrips AI chat to build a personalized itinerary in minutes, from setting preferences to refining your plan.',
    readTime: '4 min read',
    imageUrl:
      'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=80',
    content: [
      'Planning a trip used to mean juggling dozens of browser tabs, comparing flights, reading hotel reviews, and stitching together a day-by-day schedule by hand. With Atrips, you start a conversation instead. Tell the AI where you want to go, when you are traveling, who is coming along, and what kind of experiences you enjoy. It handles the rest.',
      'Start by heading to the home page and typing a simple message like "Plan a 7-day trip to Japan in April for two people who love food and temples." The AI will ask follow-up questions if it needs more detail, such as your budget range, preferred pace, or whether you want to include any specific cities. The more context you provide, the more tailored your itinerary becomes.',
      'Once the AI generates a draft itinerary, you can review each day, swap activities, adjust timing, or ask for alternatives. Say something like "Replace the museum on day 3 with a cooking class" and the plan updates instantly. When you are satisfied, save the trip to your account and access it anytime from the My Trips page.',
      'Pro tip: revisit your saved trip before departure and ask the AI to check for seasonal closures, updated opening hours, or newly opened restaurants near your hotels. Your itinerary stays a living document right up until you board the plane.',
    ],
  },
  {
    id: 'southeast-asia-budget',
    title: 'Budget Travel: Southeast Asia Under $30/Day',
    category: 'Budget Tips',
    description:
      'A practical breakdown of how to eat, sleep, and explore Southeast Asia on a tight budget without sacrificing great experiences.',
    readTime: '6 min read',
    imageUrl:
      'https://images.unsplash.com/photo-1528181304800-259b08848526?w=600&q=80',
    content: [
      'Southeast Asia remains one of the most affordable regions for travelers. Countries like Vietnam, Cambodia, Laos, and parts of Thailand and Indonesia let you live well on $25 to $30 per day if you plan wisely. That budget covers a private room in a guesthouse, three meals, local transport, and one or two activities.',
      'Accommodation is your biggest lever. Hostels run $4-8 per night for a dorm bed, while a clean private room with air conditioning costs $10-15 in most cities outside the tourist core. Book directly or walk in rather than relying solely on aggregator apps, as many family-run guesthouses offer better rates in person.',
      'Street food is both the cheapest and the best way to eat. A bowl of pho in Hanoi costs under $2, pad thai from a Bangkok street cart is about $1.50, and a full nasi goreng plate in Bali runs around $1. Eat where locals eat: busy stalls with high turnover mean fresh ingredients and safe preparation.',
      'For transport, overnight buses and trains double as accommodation and save a night of hotel cost. Grab and Go-Jek are cheaper than tuk-tuks for short hops. Rent a motorbike ($5-7/day) for exploring outside city centers, but make sure your travel insurance covers two-wheeled vehicles.',
    ],
  },
  {
    id: 'first-time-japan',
    title: 'First Time in Japan: Essential Guide',
    category: 'Destinations',
    description:
      'Everything you need to know before your first trip to Japan, from rail passes and etiquette to must-visit spots beyond Tokyo.',
    readTime: '7 min read',
    imageUrl:
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80',
    content: [
      'Japan rewards preparation. Before you arrive, purchase a Japan Rail Pass if you plan to travel between cities. The 7-day pass pays for itself with a single Tokyo-Kyoto-Osaka round trip. Activate it on the day you take your first shinkansen, not the day you land. IC cards like Suica or Pasmo work on local trains, buses, and vending machines, and can be loaded at any station.',
      'Etiquette matters more here than in most destinations. Remove your shoes when entering homes, ryokans, and some restaurants. Bow when greeting people. Do not tip; it can cause confusion. Eat ramen loudly (it signals enjoyment), but keep your voice low on trains. Trash cans are rare, so carry a small bag for your waste.',
      'Beyond Tokyo, do not skip Kyoto for its temples and bamboo groves, Osaka for street food in Dotonbori, Hiroshima for its Peace Memorial, and Hakone for hot springs with views of Mount Fuji. If you have two weeks, add Kanazawa for its traditional gardens or Takayama for a slower-paced mountain town experience.',
      'Budget-conscious travelers can eat extremely well at conveyor-belt sushi chains, ramen shops, and convenience stores like 7-Eleven and Lawson, which stock surprisingly good onigiri, sandwiches, and bento boxes. A filling meal at a gyudon chain costs under $5.',
    ],
  },
  {
    id: 'vietnamese-street-food',
    title: 'Vietnamese Street Food: A Beginner\'s Guide',
    category: 'Food',
    description:
      'Navigate Vietnam\'s vibrant street food scene with confidence. From pho and banh mi to regional specialties you won\'t find at home.',
    readTime: '5 min read',
    imageUrl:
      'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600&q=80',
    content: [
      'Vietnamese cuisine is built on a foundation of fresh herbs, rice noodles, fish sauce, and a balance of sweet, sour, salty, and spicy flavors. Street food is not a novelty here; it is the primary way most Vietnamese people eat. Tiny plastic stools on the sidewalk are your table, and the best meals often come from stalls that serve only one dish.',
      'In Hanoi, start your morning with pho bo (beef noodle soup) at a stall where the broth has been simmering since before dawn. Try bun cha for lunch: grilled pork patties with rice noodles, herbs, and a tangy dipping sauce. In the evening, seek out banh cuon, delicate steamed rice rolls filled with minced pork and mushrooms.',
      'Central Vietnam has its own distinct flavors. In Hue, try bun bo Hue, a spicy, lemongrass-infused beef noodle soup that locals consider superior to pho. In Hoi An, cao lau features thick noodles unique to the city, topped with pork, herbs, and crispy croutons. Da Nang is the place for mi quang, a turmeric-tinted noodle dish.',
      'Ho Chi Minh City runs on banh mi, the crispy baguette sandwich filled with pate, cold cuts, pickled vegetables, and chili. The city also excels at com tam (broken rice with grilled pork chop) and fresh spring rolls (goi cuon). Follow the crowds: a long line at a street stall is the best quality signal you will find.',
    ],
  },
  {
    id: 'solo-female-safety',
    title: 'Solo Female Travel Safety Tips',
    category: 'Safety',
    description:
      'Practical safety advice for women traveling alone, covering situational awareness, accommodation choices, and trusted resources.',
    readTime: '6 min read',
    imageUrl:
      'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=600&q=80',
    content: [
      'Solo female travel is safer than headlines suggest, but preparation makes the difference between a smooth trip and a stressful one. Research your destination before you go: understand local customs around dress, alcohol, and interactions with strangers. Some countries require more conservative clothing in religious sites or rural areas.',
      'Choose accommodation with good reviews from solo female travelers specifically. Hostels with female-only dorms, boutique hotels with 24-hour reception, and well-reviewed Airbnbs in central neighborhoods are all solid options. Avoid ground-floor rooms and always lock your door, even in safe-feeling areas.',
      'Share your itinerary with a trusted person at home and check in daily. Use offline maps (Google Maps lets you download regions) so you never look lost on the street. Keep your phone charged and carry a portable battery. Trust your instincts: if a situation feels wrong, leave immediately without worrying about being polite.',
      'Connect with other travelers through apps like Hostelworld social features, local meetup groups, or free walking tours. Having company for evening activities or remote excursions adds both safety and enjoyment. Many cities also have women-only travel groups on social media where you can find real-time local advice.',
    ],
  },
  {
    id: 'bali-budget',
    title: 'Bali on a Budget: Hidden Gems',
    category: 'Budget Tips',
    description:
      'Skip the overpriced tourist traps and discover affordable Bali, from quiet beaches and local warungs to free temple visits.',
    readTime: '5 min read',
    imageUrl:
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80',
    content: [
      'Bali has a reputation as an expensive destination, but that reputation comes from the tourist bubble around Seminyak and Kuta. Step outside these areas and Bali is remarkably affordable. A comfortable room in Ubud or Canggu costs $15-25 per night, and a full meal at a local warung (family restaurant) runs $1.50-3.',
      'Skip the beach clubs charging $20 for a cocktail and head to lesser-known beaches instead. Nyang Nyang Beach near Uluwatu requires a steep walk down but rewards you with an almost empty stretch of white sand. Amed on the east coast offers black sand beaches and excellent snorkeling for a fraction of south Bali prices.',
      'Temples are free or have a small donation-based entry fee. Tirta Empul, the water purification temple, charges about $2. Lempuyang Temple is free. Visit early in the morning to avoid crowds and get the best light for photos. Rent a scooter for $4-5 per day to explore at your own pace.',
      'For activities, skip the Instagram-famous swing ($35) and find a local rice terrace walk for free. The Campuhan Ridge Walk in Ubud offers stunning views with no entrance fee. Take a cooking class ($15-20) at a family home rather than a resort. Your food budget will stretch further at night markets like Gianyar, where you can sample dozens of dishes for a few dollars total.',
    ],
  },
  {
    id: 'korean-culture',
    title: 'Understanding Korean Culture for Travelers',
    category: 'Culture',
    description:
      'Key cultural norms, social etiquette, and customs that will help you connect with locals and avoid common misunderstandings in South Korea.',
    readTime: '5 min read',
    imageUrl:
      'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=600&q=80',
    content: [
      'South Korea blends deep Confucian traditions with hyper-modern pop culture. Understanding a few key customs will make your interactions smoother and earn genuine appreciation from locals. Age and hierarchy matter: always address elders and seniors with respect, and use two hands when giving or receiving objects, especially business cards.',
      'Dining has its own set of rules. Wait for the eldest person at the table to start eating before you begin. Do not pour your own drink; pour for others and they will reciprocate. When drinking with someone older, turn your head slightly to the side. Tipping is not customary and can be awkward in traditional restaurants.',
      'Shoes come off at the door in homes and many traditional restaurants. You will see shoe racks or a raised step at the entrance. Koreans are particular about cleanliness, so wearing clean, easy-to-remove shoes saves time and embarrassment. Slippers are usually provided indoors.',
      'Learning a few Korean phrases goes a long way. "Annyeonghaseyo" (hello), "kamsahamnida" (thank you), and "juseyo" (please give me) cover most basic interactions. The Korean alphabet, Hangul, can be learned in an afternoon and makes navigating menus and subway signs significantly easier.',
    ],
  },
  {
    id: 'european-rail-2026',
    title: 'European Rail Pass Guide 2026',
    category: 'Getting Started',
    description:
      'How to choose, buy, and maximize a European rail pass this year, including route tips, seat reservations, and money-saving strategies.',
    readTime: '6 min read',
    imageUrl:
      'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=600&q=80',
    content: [
      'A European rail pass remains one of the best ways to see the continent. The Eurail Global Pass covers 33 countries, and the 2026 edition includes improved digital activation through the Rail Planner app. Choose between continuous passes (unlimited travel for a set number of days) and flexi passes (a set number of travel days within a longer window).',
      'The sweet spot for most travelers is a 7-day flexi pass used over one month. This lets you take seven long-distance trains while filling the gaps with budget airlines or buses. Reserve your high-speed trains early: TGV in France, Frecciarossa in Italy, and AVE in Spain all require seat reservations ($10-25) on top of the pass.',
      'Some of Europe\'s best train journeys are included in your pass at no extra cost. The Bernina Express through the Swiss Alps, the coastal route from Nice to Cinque Terre, and the Bergen Railway across Norway\'s mountain plateaus are all spectacular. Night trains between major cities (Paris to Barcelona, Vienna to Venice) save on accommodation.',
      'To get the most value, use your pass for long-distance legs and buy point-to-point tickets for short trips under two hours, which are often cheaper than "using" a pass day. The Rail Planner app shows real-time schedules and indicates which trains require reservations so you can plan your travel days strategically.',
    ],
  },
  {
    id: 'best-time-thailand',
    title: 'Best Time to Visit Thailand',
    category: 'Destinations',
    description:
      'A month-by-month breakdown of Thailand\'s weather, festivals, and crowd levels to help you pick the ideal travel window.',
    readTime: '4 min read',
    imageUrl:
      'https://images.unsplash.com/photo-1506665531195-3566af2b4dfa?w=600&q=80',
    content: [
      'Thailand has three seasons: hot (March to May), rainy (June to October), and cool (November to February). The cool season is peak tourist time for good reason: comfortable temperatures, low humidity, and minimal rain across most of the country. Bangkok hovers around 30 degrees Celsius and the beaches are at their best.',
      'The hot season brings temperatures above 35 degrees and oppressive humidity, especially in Bangkok and the central plains. However, this is shoulder season with lower prices and fewer crowds. If you can handle the heat, April is when Songkran (Thai New Year) transforms the country into a massive water fight festival.',
      'The rainy season scares off many tourists, but it should not scare you. Rain usually falls in short, intense afternoon bursts, leaving mornings clear and landscapes brilliantly green. Prices drop 30-50% for accommodation, and popular sites like Chiang Mai temples and Railay Beach feel almost private. The exception is the Gulf Coast (Koh Samui, Koh Phangan), which gets its heaviest rain from October to December.',
      'For divers, the Andaman Sea (Phuket, Krabi, Similan Islands) is best from November to April. The Gulf side (Koh Tao, Koh Samui) has good diving conditions from March to September. If festivals matter to you, Loy Krathong in November and Yi Peng lantern festival in Chiang Mai are unforgettable cultural experiences.',
    ],
  },
  {
    id: 'export-itinerary',
    title: 'How to Export & Share Your Itinerary',
    category: 'Getting Started',
    description:
      'Step-by-step instructions for exporting your Atrips itinerary to calendar apps and sharing it with travel companions.',
    readTime: '3 min read',
    imageUrl:
      'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600&q=80',
    content: [
      'Once your AI-generated itinerary is saved, you can export it in several formats. Open any trip from your My Trips page and look for the export button in the top right. The ICS export creates a calendar file that works with Google Calendar, Apple Calendar, Outlook, and most other calendar applications. Each activity appears as a calendar event with the location, time, and any notes you added.',
      'To share your trip with travel companions, use the share button next to the export option. This generates a unique link that gives read-only access to your full itinerary. Anyone with the link can view the day-by-day plan, including maps, activity details, and timing. No Atrips account is required to view a shared trip.',
      'For offline access, the trip detail page works as a progressive web app. Save it to your home screen on iOS or Android and the itinerary loads even without internet. This is especially useful for accessing your plan during flights or in areas with unreliable connectivity.',
      'Tip: export your itinerary a day or two before departure rather than weeks ahead. This ensures any last-minute edits and AI-updated recommendations are included in the exported version.',
    ],
  },
  {
    id: 'morocco-culture',
    title: 'Morocco: A Cultural Deep Dive',
    category: 'Culture',
    description:
      'Navigate the medinas, souks, and social customs of Morocco with cultural context that transforms a visit into a meaningful experience.',
    readTime: '6 min read',
    imageUrl:
      'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=600&q=80',
    content: [
      'Morocco sits at the crossroads of Arab, Berber, and French cultures, and this blend shapes everything from architecture to cuisine to social interactions. Arabic and French are widely spoken in cities, while Berber languages (Tamazight) dominate in rural areas and the Atlas Mountains. Learning "salaam alaikum" (peace be upon you) and "shukran" (thank you) opens doors everywhere.',
      'Haggling is expected in souks and markets, but approach it as a social interaction, not a confrontation. Start at about 40% of the asking price and work toward a middle ground. Drink the mint tea offered during negotiations; refusing is considered rude. If you genuinely do not want to buy, a polite "la shukran" (no, thank you) while keeping walking is the clearest signal.',
      'Dress modestly, especially outside major cities and when visiting mosques (non-Muslims cannot enter most mosques, with the Hassan II Mosque in Casablanca being a notable exception). Women should cover shoulders and knees. Men should avoid sleeveless shirts in traditional areas. Moroccans are generally warm and hospitable, but ask permission before photographing people.',
      'Moroccan cuisine is best experienced in riads (traditional guesthouse restaurants) and local eateries rather than tourist-facing restaurants in the medina. Tagine, couscous (traditionally served on Fridays), and harira soup are staples. Street food standouts include msemen (layered flatbread), snail soup in Marrakech\'s Jemaa el-Fna square, and fresh-squeezed orange juice for about $0.50.',
    ],
  },
  {
    id: 'asian-street-markets',
    title: 'Top 10 Street Markets in Asia',
    category: 'Food',
    description:
      'The best street markets across Asia for food, atmosphere, and authentic local experiences, from Bangkok to Taipei.',
    readTime: '5 min read',
    imageUrl:
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80',
    content: [
      'Asian street markets are sensory overloads in the best possible way. Bangkok\'s Chatuchak Weekend Market is the largest outdoor market in the world, with over 15,000 stalls spread across 35 acres. Go early on Saturday morning when it opens to avoid the worst of the crowds and heat. The food section in Sections 2 and 3 serves everything from coconut ice cream to pad see ew.',
      'Taipei\'s night markets are legendary. Shilin Night Market is the most famous, but locals prefer Raohe Street Night Market for its more manageable size and superior food. Queue for the pepper buns at the entrance, then work your way through stinky tofu, oyster omelettes, and bubble tea. Night markets open around 5 PM and peak between 8 and 10 PM.',
      'In Vietnam, Ben Thanh Market in Ho Chi Minh City is a daytime institution, but the surrounding street food stalls that open at night are where the real eating happens. Hoi An\'s Central Market is smaller but exceptional for cao lau noodles and banh mi. Hanoi\'s Dong Xuan Market is the city\'s largest, with a dedicated food floor.',
      'Other markets worth planning your trip around: Tsukiji Outer Market in Tokyo for the freshest sushi breakfast of your life, Gwangjang Market in Seoul for bindaetteok (mung bean pancakes) and knife-cut noodles, Jalan Alor in Kuala Lumpur for Chinese-Malay hawker food, and the floating markets of Bangkok\'s canals for boat-served noodle soup.',
    ],
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.35,
      ease: 'easeOut' as const,
    },
  }),
};

function GuideCard({
  guide,
  index,
  onOpen,
}: {
  guide: Guide;
  index: number;
  onOpen: () => void;
}) {
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="group cursor-pointer rounded-2xl overflow-hidden border border-[var(--neutral-30)] bg-[var(--neutral-10)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-shadow duration-300"
      onClick={onOpen}
    >
      <div className="relative h-[180px] overflow-hidden">
        <Image
          src={guide.imageUrl}
          alt={guide.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

        <div className="absolute top-3 left-3">
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${CATEGORY_COLORS[guide.category]}`}
          >
            {guide.category}
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-sm font-semibold text-[var(--neutral-100)] leading-snug mb-1.5">
          {guide.title}
        </h3>
        <p className="text-xs text-[var(--neutral-60)] leading-relaxed line-clamp-2 mb-3">
          {guide.description}
        </p>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[var(--neutral-50)]">
            <Clock size={13} weight="bold" />
            <span className="text-xs">{guide.readTime}</span>
          </div>
          <div className="flex items-center gap-1 text-[var(--neutral-50)]">
            <User size={13} weight="bold" />
            <span className="text-xs">Atrips Team</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function GuideModal({
  guide,
  onClose,
}: {
  guide: Guide;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-[var(--neutral-10)] shadow-2xl flex flex-col"
      >
        {/* Header image */}
        <div className="relative h-[220px] shrink-0 overflow-hidden">
          <Image
            src={guide.imageUrl}
            alt={guide.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 640px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          <button
            onClick={onClose}
            className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>

          <div className="absolute bottom-4 left-5 right-5">
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold mb-2 ${CATEGORY_COLORS[guide.category]}`}
            >
              {guide.category}
            </span>
            <h2 className="text-xl font-bold text-white leading-tight">
              {guide.title}
            </h2>
            <div className="mt-2 flex items-center gap-3 text-white/80">
              <div className="flex items-center gap-1">
                <Clock size={13} weight="bold" />
                <span className="text-xs">{guide.readTime}</span>
              </div>
              <div className="flex items-center gap-1">
                <User size={13} weight="bold" />
                <span className="text-xs">Atrips Team</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <p className="text-sm font-medium text-[var(--neutral-80)] leading-relaxed">
            {guide.description}
          </p>
          {guide.content.map((paragraph, i) => (
            <p
              key={i}
              className="text-sm leading-relaxed text-[var(--neutral-70)]"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function GuidesContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] =
    useState<GuideCategory>('All');
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);

  const filteredGuides = useMemo(() => {
    let guides = GUIDES;

    if (activeCategory !== 'All') {
      guides = guides.filter((g) => g.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      guides = guides.filter(
        (g) =>
          g.title.toLowerCase().includes(query) ||
          g.description.toLowerCase().includes(query) ||
          g.content.some((p) => p.toLowerCase().includes(query)),
      );
    }

    return guides;
  }, [activeCategory, searchQuery]);

  function handleOpen(guide: Guide) {
    setSelectedGuide(guide);
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-8 md:px-6">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-1 flex items-center gap-3"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-surface)]">
          <BookOpen
            size={20}
            weight="fill"
            className="text-[var(--primary-main)]"
          />
        </div>
        <h2 className="text-xl font-semibold text-[var(--neutral-100)]">
          Travel Guides
        </h2>
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="mb-6 ml-[52px] text-sm text-[var(--neutral-60)]"
      >
        Expert tips and insider knowledge for your next adventure
      </motion.p>

      {/* Search bar */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mb-5"
      >
        <div className="relative">
          <MagnifyingGlass
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neutral-50)]"
          />
          <input
            type="text"
            placeholder="Search guides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] py-2.5 pl-10 pr-4 text-sm text-[var(--neutral-100)] placeholder:text-[var(--neutral-50)] focus:border-[var(--primary-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-main)]"
          />
        </div>
      </motion.div>

      {/* Category filter tabs */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="mb-8 flex gap-2 overflow-x-auto scrollbar-hide pb-1"
      >
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => {
              setActiveCategory(category);
            }}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === category
                ? 'bg-[var(--primary-main)] text-white'
                : 'border border-[var(--neutral-30)] bg-[var(--neutral-10)] text-[var(--neutral-70)] hover:border-[var(--primary-main)] hover:text-[var(--primary-main)]'
            }`}
          >
            {category}
          </button>
        ))}
      </motion.div>

      {/* Guide cards grid */}
      {filteredGuides.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGuides.map((guide, i) => (
              <GuideCard
                key={guide.id}
                guide={guide}
                index={i}
                onOpen={() => handleOpen(guide)}
              />
            ))}
          </div>

          <AnimatePresence>
            {selectedGuide && (
              <GuideModal
                guide={selectedGuide}
                onClose={() => setSelectedGuide(null)}
              />
            )}
          </AnimatePresence>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <BookOpen
            size={40}
            weight="duotone"
            className="mb-3 text-[var(--neutral-40)]"
          />
          <p className="text-sm font-medium text-[var(--neutral-60)]">
            No guides found
          </p>
          <p className="mt-1 text-xs text-[var(--neutral-50)]">
            Try a different search term or browse all categories
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('All');
            }}
            className="mt-4 rounded-full bg-[var(--primary-main)] px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Browse all guides
          </button>
        </motion.div>
      )}
    </div>
  );
}

export default function GuidesPage() {
  return <GuidesContent />;
}
