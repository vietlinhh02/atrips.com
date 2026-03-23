'use client';

import { Button } from '@/src/components/ui/button';

export function SupportSection() {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-2">
        <p className="text-[16px] font-medium text-[#eb0a0a]">Delete my account</p>
        <p className="text-[12px] text-[var(--neutral-60)]">
          Permanently delete the account and remove from all workspace.
        </p>
      </div>
      <Button
        variant="outline"
        className="border-[var(--primary-main)] text-[var(--primary-main)] hover:bg-[var(--primary-surface)] rounded-[6px] h-10"
      >
        Delete Account
      </Button>
    </div>
  );
}
