'use client';

import { cn } from '@/src/lib/utils';

interface OptionCardProps {
  icon: string;
  label: string;
  description: string;
  value: string;
  selected: boolean;
  onSelect: (value: string) => void;
  color?: string;
}

export default function OptionCard({
  icon,
  label,
  description,
  value,
  selected,
  onSelect,
  color,
}: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        'relative flex w-full flex-col items-start gap-3 rounded-xl border-2 p-6 text-left transition-all hover:border-[var(--primary-main)] hover:shadow-sm',
        selected
          ? 'border-[var(--primary-main)] bg-[var(--primary-surface)] shadow-sm'
          : 'border-[var(--neutral-30)] bg-white',
      )}
    >
      {selected && (
        <div className="absolute right-4 top-4 grid size-5 place-items-center rounded-full bg-[var(--primary-main)]">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="text-white"
          >
            <path
              d="M10 3L4.5 8.5L2 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div
          className="grid size-12 place-items-center rounded-lg text-2xl"
          style={{ backgroundColor: color ? `${color}15` : 'transparent' }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-[var(--neutral-100)]">{label}</h3>
          <p className="text-sm text-[var(--neutral-60)]">{description}</p>
        </div>
      </div>
    </button>
  );
}
