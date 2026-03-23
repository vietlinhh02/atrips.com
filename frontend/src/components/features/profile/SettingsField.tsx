import React from 'react';
import { cn } from '@/src/lib/utils';

interface SettingsFieldProps {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  description?: string;
  horizontalOnMobile?: boolean;
}

export function SettingsField({
  label,
  children,
  action,
  className,
  description,
  horizontalOnMobile = false,
}: SettingsFieldProps) {
  return (
    <div className={cn(
      "flex flex-col gap-4 md:flex-row md:items-end md:justify-between", 
      horizontalOnMobile && "flex-row items-center justify-between",
      className
    )}>
      <div className={cn("flex flex-col gap-2", horizontalOnMobile ? "flex-1" : "w-full")}>
        <label className="text-[14px] font-medium text-[var(--neutral-100)]">
          {label}
        </label>
        {description && (
           <p className="text-[12px] text-[var(--neutral-60)]">{description}</p>
        )}
        <div className="w-full">
           {children}
        </div>
      </div>
      {action && (
        <div className={cn("shrink-0", horizontalOnMobile ? "ml-3 mt-6" : "md:ml-4")}>
          {action}
        </div>
      )}
    </div>
  );
}
