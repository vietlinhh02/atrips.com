'use client';

import { AppleLogo, GoogleLogo } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/src/components/ui/button';

interface SocialLoginButtonsProps {
  onGoogleLogin?: () => void;
  onAppleLogin?: () => void;
  showDivider?: boolean;
}

export default function SocialLoginButtons({
  onGoogleLogin,
  onAppleLogin,
  showDivider = true,
}: SocialLoginButtonsProps) {
  return (
    <div className="space-y-4">
      {showDivider && (
        <div className="flex items-center gap-3 text-sm text-[var(--neutral-100)]">
          <span className="h-px flex-1 bg-[var(--neutral-30)]" />
          Or
          <span className="h-px flex-1 bg-[var(--neutral-30)]" />
        </div>
      )}

      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="h-[41px] w-full rounded-[10px] border-[var(--neutral-30)] bg-[var(--neutral-10)] text-sm font-medium text-[var(--neutral-100)] shadow-[6px_6px_32px_0_rgba(0,0,0,0.06)]"
          onClick={onGoogleLogin}
        >
          <GoogleLogo size={18} />
          Continue with Google
        </Button>
        <Button
          type="button"
          className="h-[41px] w-full rounded-[10px] bg-[#101010] text-sm font-medium text-white shadow-[6px_6px_32px_0_rgba(0,0,0,0.06)] hover:bg-[#0b0b0b]"
          onClick={onAppleLogin}
        >
          <AppleLogo size={18} weight="fill" />
          Continue with Apple
        </Button>
      </div>
    </div>
  );
}
