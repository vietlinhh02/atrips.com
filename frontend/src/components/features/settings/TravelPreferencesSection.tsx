'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/src/components/ui/use-toast';
import userService, { UserPreferences } from '@/src/services/userService';
import { SettingsField } from '@/src/components/features/profile/SettingsField';
import { Check, Plus } from '@phosphor-icons/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';

const TRAVEL_STYLES = [
  'Relaxation', 'Adventure', 'Culture', 'Food', 'Nature',
  'Urban', 'History', 'Shopping', 'Nightlife', 'Luxury'
];

const BUDGET_RANGES = [
  { value: 'backpacker', label: 'Backpacker' },
  { value: 'budget', label: 'Budget' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'mid-range', label: 'Mid-Range' },
  { value: 'comfort', label: 'Comfort' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Luxury' }
];

const DIETARY_RESTRICTIONS = [
  'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-Free',
  'Dairy-Free', 'Nut-Free', 'Seafood-Free', 'No Pork', 'No Beef'
];

const ACCESSIBILITY_NEEDS = [
  'Wheelchair Accessible', 'Elevator Required', 'Ground Floor',
  'Hearing Impaired', 'Visual Impaired', 'Limited Mobility'
];

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Vietnam (GMT+7)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (GMT+7)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
  { value: 'Asia/Seoul', label: 'Seoul (GMT+9)' },
  { value: 'Europe/London', label: 'London (GMT+0)' },
  { value: 'Europe/Paris', label: 'Paris (GMT+1)' },
  { value: 'America/New_York', label: 'New York (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8)' },
];

const PROFILE_VISIBILITY = [
  { value: 'public', label: 'Public - Anyone can see your profile' },
  { value: 'friends', label: 'Friends Only - Only friends can see' },
  { value: 'private', label: 'Private - Only you can see' },
];

export function TravelPreferencesSection() {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({});

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const data = await userService.getPreferences();
      setPreferences(data || {});
    } catch {
      console.error('Failed to load preferences');
    }
  };

  const handleUpdate = async (updates: Partial<UserPreferences>) => {
    setLoading(true);
    try {
      const updated = await userService.updatePreferences(updates);
      setPreferences(updated);
      success('Preferences updated', 'Your travel preferences have been saved.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update preferences.';
      error('Update failed', message);
    } finally {
      setLoading(false);
    }
  };

  const toggleArrayItem = (field: 'travelStyle' | 'dietaryRestrictions' | 'accessibilityNeeds', item: string) => {
    const currentItems = (preferences[field] as string[]) || [];
    const newItems = currentItems.includes(item)
      ? currentItems.filter(s => s !== item)
      : [...currentItems, item];
    handleUpdate({ [field]: newItems });
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Travel Style */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-[16px] font-medium text-[var(--neutral-100)]">Travel Style</h3>
          <p className="text-[12px] text-[var(--neutral-60)]">Select the styles that best describe your travel interests.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {TRAVEL_STYLES.map((style) => {
            const isSelected = preferences.travelStyle?.includes(style);
            return (
              <button
                key={style}
                onClick={() => toggleArrayItem('travelStyle', style)}
                disabled={loading}
                className={`
                  flex items-center gap-2 rounded-full px-4 py-2 text-[14px] transition-all border
                  ${isSelected
                    ? 'bg-[var(--primary-main)] text-white border-[var(--primary-main)]'
                    : 'bg-white text-[var(--neutral-70)] border-[var(--neutral-30)] hover:border-[var(--neutral-50)]'
                  }
                `}
              >
                {style}
                {isSelected ? <Check size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px w-full bg-[var(--neutral-30)]" />

      {/* Budget Range */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-[16px] font-medium text-[var(--neutral-100)]">Budget Range</h3>
          <p className="text-[12px] text-[var(--neutral-60)]">Your typical spending preference for trips.</p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {BUDGET_RANGES.map((range) => {
            const isSelected = preferences.budgetRange === range.value;
            return (
              <button
                key={range.value}
                onClick={() => handleUpdate({ budgetRange: range.value })}
                disabled={loading}
                className={`
                  flex flex-col items-center justify-center gap-2 rounded-[8px] p-3 text-[13px] transition-all border
                  ${isSelected
                    ? 'bg-[var(--primary-surface)] text-[var(--primary-main)] border-[var(--primary-main)] font-medium'
                    : 'bg-white text-[var(--neutral-70)] border-[var(--neutral-30)] hover:bg-[var(--neutral-20)]'
                  }
                `}
              >
                {range.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px w-full bg-[var(--neutral-30)]" />

      {/* Dietary Restrictions */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-[16px] font-medium text-[var(--neutral-100)]">Dietary Restrictions</h3>
          <p className="text-[12px] text-[var(--neutral-60)]">Select any dietary requirements for food recommendations.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {DIETARY_RESTRICTIONS.map((item) => {
            const isSelected = preferences.dietaryRestrictions?.includes(item);
            return (
              <button
                key={item}
                onClick={() => toggleArrayItem('dietaryRestrictions', item)}
                disabled={loading}
                className={`
                  flex items-center gap-2 rounded-full px-4 py-2 text-[14px] transition-all border
                  ${isSelected
                    ? 'bg-green-50 text-green-700 border-green-500'
                    : 'bg-white text-[var(--neutral-70)] border-[var(--neutral-30)] hover:border-[var(--neutral-50)]'
                  }
                `}
              >
                {item}
                {isSelected ? <Check size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px w-full bg-[var(--neutral-30)]" />

      {/* Accessibility Needs */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-[16px] font-medium text-[var(--neutral-100)]">Accessibility Needs</h3>
          <p className="text-[12px] text-[var(--neutral-60)]">Select any accessibility requirements for your travels.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {ACCESSIBILITY_NEEDS.map((item) => {
            const isSelected = preferences.accessibilityNeeds?.includes(item);
            return (
              <button
                key={item}
                onClick={() => toggleArrayItem('accessibilityNeeds', item)}
                disabled={loading}
                className={`
                  flex items-center gap-2 rounded-full px-4 py-2 text-[14px] transition-all border
                  ${isSelected
                    ? 'bg-amber-50 text-amber-700 border-amber-500'
                    : 'bg-white text-[var(--neutral-70)] border-[var(--neutral-30)] hover:border-[var(--neutral-50)]'
                  }
                `}
              >
                {item}
                {isSelected ? <Check size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px w-full bg-[var(--neutral-30)]" />

      {/* Regional Preferences */}
      <div className="flex flex-col gap-5">
        <h3 className="text-[16px] font-medium text-[var(--neutral-100)]">Regional Preferences</h3>

        <SettingsField
          label="Language"
          description="The language you prefer to use."
        >
          <Select
            value={preferences.language || 'en'}
            onValueChange={(val) => handleUpdate({ language: val })}
            disabled={loading}
          >
            <SelectTrigger className="w-full h-11 rounded-[10px] bg-[var(--neutral-20)] border-[var(--neutral-30)]">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="vi">Vietnamese</SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>

        <SettingsField
          label="Currency"
          description="The currency you prefer to see prices in."
        >
          <Select
            value={preferences.currency || 'USD'}
            onValueChange={(val) => handleUpdate({ currency: val })}
            disabled={loading}
          >
            <SelectTrigger className="w-full h-11 rounded-[10px] bg-[var(--neutral-20)] border-[var(--neutral-30)]">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="VND">VND (₫)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="JPY">JPY (¥)</SelectItem>
              <SelectItem value="KRW">KRW (₩)</SelectItem>
              <SelectItem value="THB">THB (฿)</SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>

        <SettingsField
          label="Timezone"
          description="Your local timezone for trip schedules."
        >
          <Select
            value={preferences.timezone || 'UTC'}
            onValueChange={(val) => handleUpdate({ timezone: val })}
            disabled={loading}
          >
            <SelectTrigger className="w-full h-11 rounded-[10px] bg-[var(--neutral-20)] border-[var(--neutral-30)]">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      </div>

      <div className="h-px w-full bg-[var(--neutral-30)]" />

      {/* Privacy Settings */}
      <div className="flex flex-col gap-5">
        <h3 className="text-[16px] font-medium text-[var(--neutral-100)]">Privacy Settings</h3>

        <SettingsField
          label="Profile Visibility"
          description="Control who can see your travel profile."
        >
          <Select
            value={preferences.profileVisibility || 'public'}
            onValueChange={(val) => handleUpdate({ profileVisibility: val })}
            disabled={loading}
          >
            <SelectTrigger className="w-full h-11 rounded-[10px] bg-[var(--neutral-20)] border-[var(--neutral-30)]">
              <SelectValue placeholder="Select visibility" />
            </SelectTrigger>
            <SelectContent>
              {PROFILE_VISIBILITY.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      </div>
    </div>
  );
}
