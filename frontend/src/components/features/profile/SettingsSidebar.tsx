'use client';

import {
  BellRinging,
  Cookie,
  SuitcaseRolling,
  UserCircle,
} from '@phosphor-icons/react';
import { cn } from '@/src/lib/utils';

interface SettingsSidebarProps {
  className?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function SettingsSidebar({ className, activeTab = 'account', onTabChange }: SettingsSidebarProps) {
  const settingsNav = [
    { id: 'account', label: 'Your Account', icon: UserCircle },
    { id: 'preferences', label: 'Travel Preferences', icon: SuitcaseRolling },
    { id: 'notifications', label: 'Notification Settings', icon: BellRinging },
    { id: 'cookies', label: 'Cookie Preferences', icon: Cookie },
  ];

  return (
    <aside className={cn("h-fit rounded-[8px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-4", className)}>
      <div className="flex flex-col gap-4">
        <p className="text-[11px] font-medium uppercase text-[var(--neutral-70)]">
          General Settings
        </p>
        <div className="flex flex-col gap-2">
          {settingsNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange?.(item.id)}
                className={cn(
                  'flex items-center gap-3 rounded-[6px] px-3 py-2 text-left text-[14px] transition-colors w-full',
                  isActive
                    ? 'border border-[var(--primary-outer-border)] bg-[var(--primary-surface)] text-[#000d26]'
                    : 'border border-transparent text-[var(--neutral-70)] hover:bg-[var(--neutral-20)]'
                )}
                type="button"
              >
                <Icon
                  size={18}
                  weight={isActive ? 'fill' : 'regular'}
                  className={isActive ? 'text-[var(--primary-main)]' : 'text-[var(--neutral-60)]'}
                />
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
