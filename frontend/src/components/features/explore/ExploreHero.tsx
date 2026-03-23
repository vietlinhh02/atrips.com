'use client';

import { useState, useCallback } from 'react';
import { MagnifyingGlass, Compass } from '@phosphor-icons/react';

interface ExploreHeroProps {
  seasonalBanner: string;
  onSearch: (query: string) => void;
}

export default function ExploreHero({
  seasonalBanner,
  onSearch,
}: ExploreHeroProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) onSearch(query.trim());
    },
    [query, onSearch],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <Compass size={22} weight="fill" className="text-[var(--primary-main)]" />
          <h1 className="text-[20px] md:text-[24px] font-medium leading-[1.2] text-[var(--neutral-100)]">
            Explore Destinations
          </h1>
        </div>
        <p className="mt-1 text-[14px] text-[var(--neutral-60)]">{seasonalBanner}</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl">
        <div className="flex items-center gap-2 rounded-[6px] border border-[var(--neutral-30)] bg-[var(--neutral-20)] px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md focus-within:border-[var(--primary-main)] focus-within:shadow-md">
          <MagnifyingGlass size={18} className="shrink-0 text-[var(--neutral-50)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search destinations, countries, or tags..."
            className="flex-1 border-none bg-transparent text-[14px] text-[var(--neutral-100)] outline-none placeholder:text-[var(--neutral-50)]"
          />
        </div>
      </form>
    </div>
  );
}
