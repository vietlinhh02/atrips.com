'use client';

import { useState } from 'react';
import { Eye, CaretDown, FloppyDisk, X, EyeSlash } from '@phosphor-icons/react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { SettingsField } from './SettingsField';
import ReactCountryFlag from "react-country-flag";
import { useToast } from '@/src/components/ui/use-toast';
import { ChangePasswordData } from '@/src/services/userService';

interface SecuritySectionProps {
  email?: string;
  phone?: string;
  timeZone?: string;
  onUpdatePassword?: (data: ChangePasswordData) => Promise<void>;
  onUpdatePhone?: (phone: string) => Promise<void>;
  onUpdateTimeZone?: (timeZone: string) => Promise<void>;
}

export function SecuritySection({ 
  email, 
  phone, 
  timeZone,
  onUpdatePassword, 
  onUpdatePhone, 
  onUpdateTimeZone 
}: SecuritySectionProps) {
  const { success, error } = useToast();
  
  // Phone State
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState(phone || '');
  const [savingPhone, setSavingPhone] = useState(false);

  // TimeZone State
  const [isEditingTimeZone, setIsEditingTimeZone] = useState(false);
  const [timeZoneValue, setTimeZoneValue] = useState(timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [savingTimeZone, setSavingTimeZone] = useState(false);

  // Password State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Handlers
  const handleSavePhone = async () => {
    if (!onUpdatePhone) return;
    setSavingPhone(true);
    try {
      await onUpdatePhone(phoneValue);
      success("Phone updated", "Your phone number has been updated successfully.");
      setIsEditingPhone(false);
    } catch {
      error("Update failed", "Failed to update phone number.");
    } finally {
      setSavingPhone(false);
    }
  };

  const handleSaveTimeZone = async () => {
    if (!onUpdateTimeZone) return;
    setSavingTimeZone(true);
    try {
      await onUpdateTimeZone(timeZoneValue);
      success("Time zone updated", "Your time zone has been updated successfully.");
      setIsEditingTimeZone(false);
    } catch {
      error("Update failed", "Failed to update time zone.");
    } finally {
      setSavingTimeZone(false);
    }
  };

  const handleSavePassword = async () => {
    if (!onUpdatePassword) return;
    
    if (newPassword !== confirmPassword) {
      error("Password mismatch", "New password and confirmation do not match.");
      return;
    }

    if (newPassword.length < 8) {
        error("Weak password", "Password must be at least 8 characters long.");
        return;
    }

    setSavingPassword(true);
    try {
      await onUpdatePassword({ currentPassword, newPassword });
      success("Password updated", "Your password has been changed successfully.");
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to change password. Please check your current password.";
      error("Update failed", message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Email - Read Only */}
      <SettingsField
        label="Email"
        horizontalOnMobile
        action={
          <Button
            variant="outline"
            disabled
            className="border-[var(--primary-main)] text-[var(--primary-main)] opacity-50 rounded-[6px] h-10 px-4"
          >
            Change
          </Button>
        }
      >
        <Input
          type="email"
          defaultValue={email}
          readOnly
          placeholder="ex: nvlinh0607@gmail.com"
          className="h-11 rounded-[10px] border-[var(--neutral-30)] bg-[var(--neutral-20)] text-[14px] text-[var(--neutral-100)] cursor-default focus-visible:ring-0"
        />
      </SettingsField>

      {/* Password */}
      {isChangingPassword ? (
        <div className="rounded-[10px] border border-[var(--neutral-30)] p-4 bg-[var(--neutral-10)] flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <h3 className="text-[14px] font-medium text-[var(--neutral-100)]">Change Password</h3>
            <div className="flex flex-col gap-3">
                <div className="relative">
                    <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Current Password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="h-11 rounded-[10px] border-[var(--neutral-30)] text-[14px] pr-10"
                    />
                </div>
                <div className="relative">
                    <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-11 rounded-[10px] border-[var(--neutral-30)] text-[14px] pr-10"
                    />
                </div>
                <div className="relative">
                    <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm New Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-11 rounded-[10px] border-[var(--neutral-30)] text-[14px] pr-10"
                    />
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--neutral-60)]"
                    >
                        {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                    </button>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <Button 
                    variant="ghost" 
                    onClick={() => setIsChangingPassword(false)}
                    disabled={savingPassword}
                >
                    Cancel
                </Button>
                <Button 
                    onClick={handleSavePassword}
                    disabled={savingPassword || !currentPassword || !newPassword}
                    className="bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)]"
                >
                    {savingPassword ? "Saving..." : "Save Password"}
                </Button>
            </div>
        </div>
      ) : (
        <SettingsField
            label="Password"
            horizontalOnMobile
            action={
            <Button
                variant="outline"
                onClick={() => setIsChangingPassword(true)}
                className="border-[var(--primary-main)] text-[var(--primary-main)] hover:bg-[var(--primary-surface)] rounded-[6px] h-10 px-4"
            >
                Change
            </Button>
            }
        >
            <div className="relative">
            <Input
                type="password"
                placeholder="••••••••"
                readOnly
                className="h-11 rounded-[10px] border-[var(--neutral-30)] bg-[var(--neutral-20)] text-[14px] text-[var(--neutral-100)] pr-10 cursor-default focus-visible:ring-0"
            />
            <Eye
                size={18}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--neutral-60)]"
            />
            </div>
        </SettingsField>
      )}

      {/* Phone Number */}
      <SettingsField
        label="Phone Number"
        horizontalOnMobile
        action={
          isEditingPhone ? (
            <div className="flex gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                        setPhoneValue(phone || '');
                        setIsEditingPhone(false);
                    }}
                    disabled={savingPhone}
                    className="h-10 w-10 text-[var(--neutral-60)]"
                >
                    <X size={18} />
                </Button>
                <Button
                    size="icon"
                    onClick={handleSavePhone}
                    disabled={savingPhone}
                    className="h-10 w-10 bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)] rounded-[6px]"
                >
                    <FloppyDisk size={18} />
                </Button>
            </div>
          ) : (
            <Button
                variant="outline"
                onClick={() => setIsEditingPhone(true)}
                className="border-[var(--primary-main)] text-[var(--primary-main)] hover:bg-[var(--primary-surface)] rounded-[6px] h-10 px-4"
            >
                {phone ? 'Change' : 'Add Phone'}
            </Button>
          )
        }
      >
        <div className={`flex h-11 overflow-hidden rounded-[10px] border transition-colors ${isEditingPhone ? 'border-[var(--primary-main)]' : 'border-[var(--neutral-30)]'}`}>
          <div className="flex items-center border-r border-[var(--neutral-30)] bg-[var(--neutral-20)] px-3 text-[14px] text-[var(--neutral-60)]">
            +84
          </div>
          <div className={`flex flex-1 items-center justify-between gap-3 px-4 text-[14px] text-[var(--neutral-60)] ${isEditingPhone ? 'bg-white' : 'bg-[var(--neutral-20)]'}`}>
            <input
              type="tel"
              readOnly={!isEditingPhone}
              value={phoneValue}
              onChange={(e) => setPhoneValue(e.target.value)}
              placeholder="Input your phone"
              className={`w-full bg-transparent text-[14px] text-[var(--neutral-100)] outline-none placeholder:text-[var(--neutral-60)] ${!isEditingPhone && 'cursor-default'}`}
            />
            <div className="flex items-center gap-1">
              <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full">
                <ReactCountryFlag
                   countryCode="VN"
                   svg
                   style={{
                    width: '1.5em',
                    height: '1.5em',
                   }}
                   title="VN"
                />
              </div>
              <CaretDown size={14} className="text-[var(--neutral-60)]" />
            </div>
          </div>
        </div>
      </SettingsField>

      {/* Time Zone */}
      <SettingsField
        label="Time Zone"
        horizontalOnMobile
        action={
          isEditingTimeZone ? (
            <div className="flex gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                        setTimeZoneValue(timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
                        setIsEditingTimeZone(false);
                    }}
                    disabled={savingTimeZone}
                    className="h-10 w-10 text-[var(--neutral-60)]"
                >
                    <X size={18} />
                </Button>
                <Button
                    size="icon"
                    onClick={handleSaveTimeZone}
                    disabled={savingTimeZone}
                    className="h-10 w-10 bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)] rounded-[6px]"
                >
                    <FloppyDisk size={18} />
                </Button>
            </div>
          ) : (
            <Button
                variant="outline"
                onClick={() => setIsEditingTimeZone(true)}
                className="border-[var(--primary-main)] text-[var(--primary-main)] hover:bg-[var(--primary-surface)] rounded-[6px] h-10 px-4"
            >
                Change
            </Button>
          )
        }
      >
        <Input
          type="text"
          value={timeZoneValue}
          readOnly={!isEditingTimeZone}
          onChange={(e) => setTimeZoneValue(e.target.value)}
          placeholder="ex: Asia/Ho_Chi_Minh"
          className={`h-11 rounded-[10px] border border-[var(--neutral-30)] text-[14px] text-[var(--neutral-100)] ${isEditingTimeZone ? 'bg-white border-[var(--primary-main)]' : 'bg-[var(--neutral-20)] cursor-default'}`}
        />
      </SettingsField>
    </div>
  );
}
