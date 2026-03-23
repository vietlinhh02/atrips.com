'use client';

import React from 'react';
import useAuthStore from '@/src/stores/authStore';
import useSettingsStore from '@/src/stores/settingsStore';
import userService, { UpdateProfileData, ChangePasswordData } from '@/src/services/userService';
import { SettingsSidebar } from '@/src/components/features/profile/SettingsSidebar';
import { ProfilePictureSection } from '@/src/components/features/profile/ProfilePictureSection';
import { SecuritySection } from '@/src/components/features/profile/SecuritySection';
import { SupportSection } from '@/src/components/features/profile/SupportSection';
import { TravelPreferencesSection } from '@/src/components/features/settings/TravelPreferencesSection';
import { NotificationSettingsSection } from '@/src/components/features/settings/NotificationSettingsSection';
import { CookiePreferencesSection } from '@/src/components/features/settings/CookiePreferencesSection';
import { Tabs, TabsList, TabsTrigger } from '@/src/components/ui/tabs';

function AccountContent() {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);


  const handleUpdateProfile = async (data: UpdateProfileData) => {
    try {
      await updateProfile(data);
    } catch (error) {
      console.error('Update failed:', error);
      throw error;
    }
  };

  const handleUpdatePhone = async (phone: string) => {
    await handleUpdateProfile({ phone });
  };

  const handleUpdatePassword = async (data: ChangePasswordData) => {
    await userService.changePassword(data);
  };

  const handleUpdateTimeZone = async (timeZone: string) => {
    await userService.updatePreferences({ timezone: timeZone });
  };

  return (
    <div className="flex flex-col gap-8">
      <ProfilePictureSection
        avatarUrl={user?.avatarUrl || undefined}
        name={user?.name || user?.displayName || ''}
        email={user?.email || undefined}
        bio={user?.bio || undefined}
        onUpdate={handleUpdateProfile}
      />

      <SecuritySection
        email={user?.email || undefined}
        phone={user?.phone || undefined}
        onUpdatePassword={handleUpdatePassword}
        onUpdatePhone={handleUpdatePhone}
        onUpdateTimeZone={handleUpdateTimeZone}
      />

      <SupportSection />
    </div>
  );
}

function SettingsContent() {
  const { activeTab, setActiveTab } = useSettingsStore();

  const renderContent = () => {
    switch (activeTab) {
      case 'account':
        return <AccountContent />;
      case 'preferences':
        return (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <TravelPreferencesSection />
          </div>
        );
      case 'notifications':
        return (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <NotificationSettingsSection />
          </div>
        );

      case 'cookies':
        return (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <CookiePreferencesSection />
          </div>
        );
      default:
        return <AccountContent />;
    }
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'account': return 'Your Account';
      case 'preferences': return 'Travel Preferences';
      case 'notifications': return 'Notification Settings';

      case 'cookies': return 'Cookie Preferences';
      default: return 'Settings';
    }
  };

  return (
    <div className="w-full px-6 py-6">
      <div className="flex flex-col gap-6">
        {/* Title for mobile */}
        <div className="lg:hidden flex items-center justify-between">
          <h1 className="text-[18px] font-medium text-[var(--neutral-100)]">{getTitle()}</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[248px_1fr]">
          <SettingsSidebar
            className="hidden lg:block"
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <div className="flex min-w-0 flex-col gap-8 pb-10">
            {/* Header for mobile - Tabs Navigation */}
            <div className="lg:hidden mb-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full h-auto p-1 bg-[var(--neutral-10)] border border-[var(--neutral-30)] rounded-lg flex flex-wrap gap-1 justify-start">
                  <TabsTrigger value="account" className="flex-grow basis-0">Account</TabsTrigger>
                  <TabsTrigger value="preferences" className="flex-grow basis-0">Preferences</TabsTrigger>
                  <TabsTrigger value="notifications" className="flex-grow basis-0">Notification</TabsTrigger>

                  <TabsTrigger value="cookies" className="flex-grow basis-0">Cookies</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return <SettingsContent />;
}
