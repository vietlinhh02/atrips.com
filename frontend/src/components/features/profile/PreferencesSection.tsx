'use client';

import { useEffect, useState } from 'react';
import userService, { UserPreferences } from '@/src/services/userService';
import { useToast } from '@/src/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";

export function PreferencesSection() {
  const toast = useToast();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const data = await userService.getPreferences();
        setPreferences(data);
      } catch (error) {
        console.error('Failed to load preferences', error);
        toast.error("Error", "Failed to load preferences.");
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [toast]);

  const handleSave = async () => {
    if (!preferences) return;
    setSaving(true);
    try {
      await userService.updatePreferences(preferences);
      toast.success("Success", "Preferences updated successfully.");
    } catch (error) {
      console.error('Failed to update preferences', error);
      toast.error("Error", "Failed to update preferences.");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof UserPreferences, value: string | string[] | boolean | null) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [field]: value });
  };

  if (loading) {
    return <div className="p-4 text-[var(--neutral-70)]">Loading preferences...</div>;
  }

  if (!preferences) {
    return <div className="p-4 text-[var(--neutral-70)]">No preferences found.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-[24px] font-medium text-[var(--neutral-100)]">Travel Preferences</h2>
        <p className="text-[14px] text-[var(--neutral-70)]">
          Customize your travel experience and app settings.
        </p>
      </div>
      <div className="h-px w-full bg-[var(--neutral-30)]" />

      {/* Form */}
      <div className="grid gap-6 md:grid-cols-2">

        {/* Language */}
        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-medium text-[var(--neutral-90)]">Language</label>
          <Select
            value={preferences.language || 'en'}
            onValueChange={(value) => handleChange('language', value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="vi">Tiếng Việt</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Currency */}
        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-medium text-[var(--neutral-90)]">Currency</label>
          <Select
            value={preferences.currency || 'USD'}
            onValueChange={(value) => handleChange('currency', value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="VND">VND (₫)</SelectItem>
              <SelectItem value="JPY">JPY (¥)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Timezone */}
        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-medium text-[var(--neutral-90)]">Timezone</label>
          <Select
            value={preferences.timezone || 'UTC'}
            onValueChange={(value) => handleChange('timezone', value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UTC">UTC</SelectItem>
              <SelectItem value="Asia/Ho_Chi_Minh">Vietnam (GMT+7)</SelectItem>
              <SelectItem value="America/New_York">New York (EST)</SelectItem>
              <SelectItem value="Europe/London">London (GMT)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Profile Visibility */}
        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-medium text-[var(--neutral-90)]">Profile Visibility</label>
          <Select
            value={preferences.profileVisibility || 'public'}
            onValueChange={(value) => handleChange('profileVisibility', value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="friends">Friends Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="flex flex-col gap-4 pt-4">
        <h3 className="text-[16px] font-medium text-[var(--neutral-100)]">Notifications</h3>

        <div className="flex items-center justify-between rounded-[8px] border border-[var(--neutral-30)] p-4">
          <div className="flex flex-col">
            <span className="text-[14px] font-medium text-[var(--neutral-90)]">Email Notifications</span>
            <span className="text-[12px] text-[var(--neutral-60)]">Receive updates via email</span>
          </div>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--primary-main)]"
            checked={preferences.emailNotifications}
            onChange={(e) => handleChange('emailNotifications', e.target.checked)}
          />
        </div>

        <div className="flex items-center justify-between rounded-[8px] border border-[var(--neutral-30)] p-4">
          <div className="flex flex-col">
            <span className="text-[14px] font-medium text-[var(--neutral-90)]">Push Notifications</span>
            <span className="text-[12px] text-[var(--neutral-60)]">Receive updates via app notifications</span>
          </div>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--primary-main)]"
            checked={preferences.pushNotifications}
            onChange={(e) => handleChange('pushNotifications', e.target.checked)}
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-[8px] bg-[var(--primary-main)] px-6 py-2 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
