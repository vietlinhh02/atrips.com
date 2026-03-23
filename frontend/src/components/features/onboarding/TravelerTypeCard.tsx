'use client';

import { cn } from '@/src/lib/utils';

interface TravelerTypeCardProps {
  icon: string;
  label: string;
  description: string;
  value: string;
  color: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: (value: string) => void;
}

export default function TravelerTypeCard({
  icon,
  label,
  description,
  value,
  color,
  selected,
  disabled,
  onSelect,
}: TravelerTypeCardProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(value)}
      disabled={disabled}
      className={cn(
        'relative flex w-full flex-col gap-3 rounded-xl border-2 p-6 text-left transition-all',
        selected
          ? 'border-[var(--primary-main)] bg-[var(--primary-surface)] shadow-sm'
          : 'border-[var(--neutral-30)] bg-white hover:border-[var(--primary-main)] hover:shadow-sm',
        disabled && !selected && 'cursor-not-allowed opacity-50',
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
      <div
        className="grid size-14 place-items-center rounded-xl text-3xl"
        style={{ backgroundColor: `${color}15` }}
      >
        {icon}
      </div>
      <div>
        <h3 className="mb-1 text-base font-semibold text-[var(--neutral-100)]">{label}</h3>
        <p className="text-sm text-[var(--neutral-60)]">{description}</p>
      </div>
    </button>
  );
}
