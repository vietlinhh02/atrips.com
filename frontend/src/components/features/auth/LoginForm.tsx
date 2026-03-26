'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useAuthStore from '@/src/stores/authStore';
import { Eye, EyeSlash } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { toast } from '@/src/components/ui/use-toast';
import travelProfileService from '@/src/services/travelProfileService';
import { getPostLoginRedirect } from '@/src/lib/pendingChat';
import BrandHeader from '@/src/components/common/brand/BrandHeader';
import SocialLoginButtons from '@/src/components/common/layout/SocialLoginButtons';
import AuthFooter from '@/src/components/common/layout/AuthFooter';

export default function LoginForm() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);

  const user = useAuthStore((state) => state.user);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      if (user) {
        // Don't redirect if user hasn't verified email yet
        if (!user.emailVerified) {
          return;
        }

        try {
          const { needsOnboarding, currentStep } = await travelProfileService.needsOnboarding();
          if (needsOnboarding) {
            // Step 4 is the result page
            const targetRoute = currentStep === 4
              ? '/onboarding/result'
              : `/onboarding?step=${currentStep}`;
            router.replace(targetRoute);
            return;
          }
        } catch {
          // If onboarding check fails, continue to dashboard
        }
        
        // Check for pending chat message or redirect URL
        const redirectUrl = await getPostLoginRedirect('/');
        router.replace(redirectUrl);
      }
    };
    checkAuth();
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await login(formData);

      if (!user.emailVerified) {
        router.push(`/verify-email?email=${encodeURIComponent(user.email)}`);
        return;
      }

      try {
        const { needsOnboarding, currentStep } = await travelProfileService.needsOnboarding();
        if (needsOnboarding) {
          // Step 4 is the result page
          const targetRoute = currentStep === 4
            ? '/onboarding/result'
            : `/onboarding?step=${currentStep}`;
          router.push(targetRoute);
          return;
        }
      } catch {
        // If onboarding check fails, continue to dashboard.
      }

      // ✅ NEW: Check for redirect URL from middleware
      const searchParams = new URLSearchParams(window.location.search);
      const redirectUrl = searchParams.get('redirect');

      if (redirectUrl && redirectUrl.startsWith('/')) {
        router.push(redirectUrl);
        return;
      }

      // Default redirect - Check for pending chat message or redirect URL
      const defaultRedirect = await getPostLoginRedirect('/');
      router.push(defaultRedirect);
    } catch (error: unknown) {
      const data = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string | { message?: string; code?: string }; errors?: string[] } } }).response?.data
        : undefined;
      const rawError = data?.error;
      const errorCode = typeof rawError === 'object' ? rawError?.code : undefined;

      // Unverified email: redirect to OTP verification page
      if (errorCode === 'EMAIL_NOT_VERIFIED') {
        toast.info('Vui lòng xác thực email. Mã OTP đã được gửi lại.');
        router.push(`/verify-email?email=${encodeURIComponent(formData.email)}`);
        return;
      }

      const message = typeof rawError === 'string'
        ? rawError
        : rawError?.message || 'Đăng nhập thất bại';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[327px] flex-col gap-6 sm:max-w-[420px] sm:gap-8 lg:max-w-[564px] lg:gap-[40px]">
      <BrandHeader logoSize="medium" />

      <div className="space-y-2 sm:space-y-3">
        <h1 className="text-[28px] font-medium leading-[1.2] text-[var(--neutral-100)] sm:text-[32px] lg:text-[40px]">
          Discover The World With Easy
        </h1>
        <p className="text-sm text-[var(--neutral-60)]">
          Sign in to TripMind and turn travel dreams into plans.
        </p>
      </div>

      <div className="rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">Lưu ý</p>
        <p>Hệ thống đang tạm thời không gửi được OTP. Vui lòng đăng nhập bằng Google.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="login-email" className="text-sm font-medium text-[var(--neutral-100)]">Email</label>
            <Input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="ex: vanuel010@gmail.com"
              className="h-[41px] rounded-[10px] border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="login-password" className="text-sm font-medium text-[var(--neutral-100)]">Password</label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="********"
                className="h-[41px] rounded-[10px] border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 pr-11 text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--neutral-60)] transition hover:text-[var(--neutral-100)]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <Link
              href="/forgot-password"
              className="block text-right text-sm text-[var(--primary-main)] hover:text-[var(--primary-hover)]"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <Button
            type="submit"
            disabled={loading}
            className="h-[41px] w-full rounded-[10px] bg-[var(--primary-main)] text-sm font-medium text-white shadow-[6px_6px_32px_0_rgba(0,0,0,0.06)] hover:bg-[var(--primary-hover)]"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>

          <p className="text-center text-sm text-[var(--neutral-60)]">
            Don&apos;t Have an Account?{' '}
            <Link href="/signup" className="font-medium text-[var(--primary-main)]">
              Register Now
            </Link>
          </p>

          <SocialLoginButtons onGoogleLogin={loginWithGoogle} />
        </div>
      </form>

      <AuthFooter />
    </div>
  );
}
