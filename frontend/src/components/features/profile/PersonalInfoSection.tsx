'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/src/components/ui/input';
import { useToast } from '@/src/components/ui/use-toast';

interface PersonalInfoSectionProps {
  firstName?: string;
  lastName?: string;
  phone?: string;
  onUpdate: (data: { name?: string; phone?: string }) => Promise<void>;
}

export function PersonalInfoSection({ firstName = '', lastName = '', phone = '', onUpdate }: PersonalInfoSectionProps) {
  const [fName, setFName] = useState(firstName);
  const [lName, setLName] = useState(lastName);
  const [phoneState, setPhoneState] = useState(phone || '');
  const [phoneError, setPhoneError] = useState('');
  
  const { success, error } = useToast();

  useEffect(() => {
    if (firstName !== fName) setFName(firstName);
    if (lastName !== lName) setLName(lastName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName]);

  useEffect(() => {
    const newPhoneValue = phone || '';
    if (phoneState !== newPhoneValue) setPhoneState(newPhoneValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const handleBlur = async () => {
    const updates: Record<string, string> = {};

    // Name Check
    if (fName !== firstName || lName !== lastName) {
      updates.name = `${fName} ${lName}`.trim();
    }

    // Phone Check
    if (phoneState !== (phone || '')) {
      const trimmedPhone = phoneState.trim();
      
      // If empty, it's valid (optional)
      if (!trimmedPhone) {
        updates.phone = '';
        setPhoneError('');
      } else {
        // Regex: Optional +, starts with 1-9, followed by 1-14 digits. Total 2-15 digits.
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        
        if (phoneRegex.test(trimmedPhone)) {
          updates.phone = trimmedPhone;
          setPhoneError('');
        } else {
          setPhoneError("Please provide a valid phone number");
          return; // Don't proceed with update if validation fails
        }
      }
    }

    // If there are valid updates, send them
    if (Object.keys(updates).length > 0) {
      try {
        await onUpdate(updates);
        success("Profile updated", "Your information has been updated successfully.");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to update your information. Please try again.";
        error("Update failed", message);
        
        // Only revert fields that failed to update if needed, but for now we might keep them
        // or we could revert to props if we want to be strict.
        // Let's revert specific fields on error to stay consistent with previous behavior
        if (updates.name) {
          setFName(firstName);
          setLName(lastName);
        }
        if (updates.phone !== undefined) {
          setPhoneState(phone || '');
        }
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <label className="text-[14px] font-semibold text-[var(--neutral-100)] ml-1">
          Phone Number
        </label>
        <div className="flex flex-col gap-1.5">
          <Input
            type="tel"
            value={phoneState}
            onChange={(e) => setPhoneState(e.target.value)}
            onBlur={handleBlur}
            placeholder="981601209"
            className={`h-12 rounded-[12px] border-[var(--neutral-30)] bg-[var(--neutral-10)] text-[15px] text-[var(--neutral-100)] focus:border-[var(--primary-main)] focus:ring-1 focus:ring-[var(--primary-main)] transition-all px-4 ${
              phoneError ? 'border-red-500 focus-visible:ring-red-500' : ''
            }`}
          />
          {phoneError && (
            <span className="text-[12px] text-red-500 font-medium ml-1">{phoneError}</span>
          )}
          <span className="text-[13px] text-[var(--neutral-60)] ml-1">
            Optional. International format (e.g. +84...)
          </span>
        </div>
      </div>
    </div>
  );
}
