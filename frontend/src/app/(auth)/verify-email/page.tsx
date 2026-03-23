'use client';

import { useMemo, useRef, useState, Fragment } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EnvelopeSimple, ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import { toast } from '@/src/components/ui/use-toast';
import api from '@/src/lib/api';
import BrandHeader from '@/src/components/common/brand/BrandHeader';
import AuthFooter from '@/src/components/common/layout/AuthFooter';
import Link from 'next/link';
import { Button } from '@/src/components/ui/button';

import useAuthStore from '@/src/stores/authStore';
import { getPostLoginRedirect } from '@/src/lib/pendingChat';
import travelProfileService from '@/src/services/travelProfileService';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);

  const email = useMemo(
    () => searchParams.get('email') || 'your@email.com',
    [searchParams],
  );
  const [code, setCode] = useState(Array(6).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const verifyOtp = async (otp: string) => {
    if (isVerifying) return;
    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const response = await api.post('/auth/verify-email', { otp, email });
      // We don't need 'user' here as we'll fetch fresh state, but we need tokens
      const { tokens } = response.data.data || {};

      // Store tokens if provided
      if (tokens) {
        localStorage.setItem('accessToken', tokens.accessToken);
        if (tokens.refreshToken) {
          localStorage.setItem('refreshToken', tokens.refreshToken);
        }
      }

      // Sync auth state before redirecting
      // This ensures OnboardingWizard sees the user as verified
      await fetchCurrentUser();

      // Check if there's a redirect param (from signup with pending chat message)
      const redirect = searchParams.get('redirect');
      if (redirect) {
        // Check for pending chat message
        const redirectUrl = await getPostLoginRedirect(redirect);
        router.replace(redirectUrl);
        return;
      }

      // Check onboarding status
      try {
        const { needsOnboarding } = await travelProfileService.needsOnboarding();
        if (!needsOnboarding) {
          // No onboarding needed and no redirect, go home
          router.replace('/');
          return;
        }
      } catch {
        // If check fails, continue to onboarding
      }

      // Redirect to onboarding
      router.replace('/onboarding');
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      const data = error.response?.data;
      const rawError = data?.error;
      const message = typeof rawError === 'string'
        ? rawError
        : rawError?.message || 'Verification failed';
      setErrorMessage(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const resendOtp = async () => {
    if (isResending) return;
    setIsResending(true);
    setErrorMessage(null); // Clear any previous errors on resend
    try {
      await api.post('/auth/resend-verification', { email });
      toast.success('Code resent', 'Please check your inbox.');
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      const data = error.response?.data;
      const rawError = data?.error;
      const message = typeof rawError === 'string'
        ? rawError
        : rawError?.message || 'Resend failed';
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  const submitIfComplete = (updated: string[]) => {
    const isComplete = updated.every((digit) => digit.length === 1);
    if (isComplete) {
      verifyOtp(updated.join(''));
    }
  };

  const handleChange = (index: number, value: string) => {
    // Clear error when user starts typing again
    if (errorMessage) setErrorMessage(null);

    const next = value.replace(/\D/g, '').slice(-1);
    const updated = [...code];
    updated[index] = next;
    setCode(updated);

    if (next && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    submitIfComplete(updated);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      // Clear error on backspace too
      if (errorMessage) setErrorMessage(null);

      if (!code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (errorMessage) setErrorMessage(null);

    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) {
      return;
    }

    event.preventDefault();
    const updated = Array(6).fill('');
    pasted.split('').forEach((digit, idx) => {
      updated[idx] = digit;
    });
    setCode(updated);

    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
    submitIfComplete(updated);
  };

  return (
    <div className="mx-auto flex w-full max-w-[327px] flex-col gap-6 sm:max-w-[420px] sm:gap-8 lg:max-w-[564px] lg:gap-[40px]">
      <BrandHeader logoSize="medium" />

      <div className="space-y-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-[var(--neutral-60)] hover:text-[var(--neutral-100)] transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Login
        </Link>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-[12px] bg-[var(--primary-main)] shadow-[0_0_0_1px_rgba(0,30,28,0.32)]">
              <EnvelopeSimple size={24} weight="bold" className="text-white" />
            </div>
            <h1 className="text-[24px] font-medium text-[var(--neutral-100)] lg:text-[32px]">
              Verify Email
            </h1>
          </div>
          <p className="text-sm text-[var(--neutral-60)] leading-relaxed">
            We&apos;ve sent a six-digit confirmation code to{' '}
            <span className="font-medium text-[var(--neutral-100)]">{email}</span>.
            Please enter it below to verify your email address.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <div className="space-y-2">
          <div className="flex flex-nowrap items-center justify-between gap-2">
            {code.map((digit, index) => (
              <Fragment key={index}>
                <input
                  value={digit}
                  onChange={(event) => handleChange(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={handlePaste}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  className={`h-[48px] w-[40px] rounded-[10px] border bg-[var(--neutral-10)] text-center text-[20px] text-[var(--neutral-100)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] sm:h-[56px] sm:w-[52px] sm:text-[22px] transition-all duration-200 outline-none ${errorMessage
                    ? 'border-red-500 ring-2 ring-red-500/20'
                    : digit
                      ? 'border-[var(--primary-main)] ring-2 ring-[var(--primary-main)]/20'
                      : 'border-[var(--neutral-30)] hover:border-[var(--neutral-40)] focus:border-[var(--primary-main)] focus:ring-2 focus:ring-[var(--primary-main)]/20'
                    } ${isVerifying ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  inputMode="numeric"
                  maxLength={1}
                  disabled={isVerifying}
                  autoFocus={index === 0}
                />
                {index === 2 ? (
                  <span className="hidden px-1 text-[22px] font-light text-[var(--neutral-60)] sm:block sm:text-[24px] leading-none pb-1">
                    -
                  </span>
                ) : null}
              </Fragment>
            ))}
          </div>
          {errorMessage && (
            <p className="text-center text-sm font-medium text-red-500 animate-in fade-in slide-in-from-top-1">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <Button
            onClick={() => verifyOtp(code.join(''))}
            disabled={isVerifying || code.some(d => d === '')}
            className="h-[41px] w-full rounded-[10px] bg-[var(--primary-main)] text-sm font-medium text-white shadow-[6px_6px_32px_0_rgba(0,0,0,0.06)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verifying...
              </span>
            ) : (
              'Verify Email'
            )}
          </Button>

          <p className="text-center text-sm text-[var(--neutral-60)]">
            Didn&apos;t receive a code?{' '}
            <button
              type="button"
              className="font-medium text-[var(--primary-main)] hover:underline disabled:opacity-50"
              onClick={resendOtp}
              disabled={isResending}
            >
              {isResending ? 'Sending...' : 'Send code again'}
            </button>
          </p>
        </div>
      </div>

      <AuthFooter />
    </div>
  );
}
