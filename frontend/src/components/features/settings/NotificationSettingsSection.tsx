'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/src/components/ui/use-toast';
import userService, { UserPreferences } from '@/src/services/userService';

export function NotificationSettingsSection() {
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
      success('Settings saved', 'Notification settings updated successfully.');
    } catch {
      error('Update failed', 'Failed to update notification settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h3 className="text-[16px] font-medium text-[var(--neutral-100)]">Email Notifications</h3>
        <p className="text-[12px] text-[var(--neutral-60)]">Choose what updates you want to receive via email.</p>
        
        <div className="flex items-center justify-between py-3 border-b border-[var(--neutral-30)]">
          <div className="flex flex-col gap-1">
            <span className="text-[14px] font-medium text-[var(--neutral-100)]">Marketing Emails</span>
            <span className="text-[12px] text-[var(--neutral-60)]">Receive updates about new features and promotions.</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer"
              checked={preferences.emailNotifications ?? true}
              onChange={(e) => handleUpdate({ emailNotifications: e.target.checked })}
              disabled={loading}
            />
            <div className="w-11 h-6 bg-[var(--neutral-30)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary-main)]"></div>
          </label>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-[var(--neutral-30)]">
          <div className="flex flex-col gap-1">
            <span className="text-[14px] font-medium text-[var(--neutral-100)]">Security Alerts</span>
            <span className="text-[12px] text-[var(--neutral-60)]">Get notified about login attempts and password changes.</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer"
              checked={true} 
              disabled={true} // Usually forced for security
            />
            <div className="w-11 h-6 bg-[var(--neutral-30)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary-main)] opacity-70"></div>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-[16px] font-medium text-[var(--neutral-100)]">Push Notifications</h3>
        <p className="text-[12px] text-[var(--neutral-60)]">Manage notifications sent to your devices.</p>
        
        <div className="flex items-center justify-between py-3 border-b border-[var(--neutral-30)]">
          <div className="flex flex-col gap-1">
            <span className="text-[14px] font-medium text-[var(--neutral-100)]">Trip Updates</span>
            <span className="text-[12px] text-[var(--neutral-60)]">Get real-time updates about your itinerary.</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer"
              checked={preferences.pushNotifications ?? true}
              onChange={(e) => handleUpdate({ pushNotifications: e.target.checked })}
              disabled={loading}
            />
            <div className="w-11 h-6 bg-[var(--neutral-30)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary-main)]"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
