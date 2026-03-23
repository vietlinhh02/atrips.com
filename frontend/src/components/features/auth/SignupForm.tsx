'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeSlash } from '@phosphor-icons/react/dist/ssr';
import useAuthStore from '@/src/stores/authStore';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { toast } from '@/src/components/ui/use-toast';
import travelProfileService from '@/src/services/travelProfileService';
import BrandHeader from '@/src/components/common/brand/BrandHeader';
import SocialLoginButtons from '@/src/components/common/layout/SocialLoginButtons';
import AuthFooter from '@/src/components/common/layout/AuthFooter';

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signup = useAuthStore((state) => state.signup);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const user = useAuthStore((state) => state.user);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
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
        }
        router.replace('/');
      }
    };
    checkAuth();
  }, [user, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const name = `${formData.firstName} ${formData.lastName}`.trim();
      await signup({
        email: formData.email,
        password: formData.password,
        name: name || formData.email,
        displayName: formData.firstName || undefined,
      });
      
      // Preserve redirect param if exists (for pending chat message flow)
      const redirect = searchParams.get('redirect');
      const redirectParam = redirect ? `&redirect=${encodeURIComponent(redirect)}` : '';
      router.push(`/verify-email?email=${encodeURIComponent(formData.email)}${redirectParam}`);
    } catch (error: unknown) {
      const data = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string | { message?: string }; errors?: string[] } } }).response?.data
        : undefined;
      const rawError = data?.error;
      const message = typeof rawError === 'string'
        ? rawError
        : rawError?.message || 'Đăng ký thất bại';
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
          Create Your TripMind Account
        </h1>
        <p className="text-sm text-[var(--neutral-60)]">
          Join TripMind and start planning your trips effortlessly it&apos;s free.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 space-y-2">
              <label htmlFor="signup-firstName" className="text-sm font-medium text-[var(--neutral-100)]">
                First Name
              </label>
              <Input
                id="signup-firstName"
                type="text"
                name="firstName"
                autoComplete="given-name"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter your first name"
                className="h-[41px] rounded-[10px] border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 text-sm focus-visible:border-[var(--neutral-30)] focus-visible:ring-0 lg:border-[var(--primary-main)] lg:shadow-[0_0_0_2px_rgba(0,30,28,0.32)]"
                required
              />
            </div>
            <div className="flex-1 space-y-2">
              <label htmlFor="signup-lastName" className="text-sm font-medium text-[var(--neutral-100)]">
                Last Name
              </label>
              <Input
                id="signup-lastName"
                type="text"
                name="lastName"
                autoComplete="family-name"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Enter your last name"
                className="h-[41px] rounded-[10px] border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 text-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-email" className="text-sm font-medium text-[var(--neutral-100)]">Email</label>
            <Input
              id="signup-email"
              type="email"
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="ex: vanuel010@gmail.com"
              className="h-[41px] rounded-[10px] border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-password" className="text-sm font-medium text-[var(--neutral-100)]">
              Password
            </label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
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
          </div>

          <label htmlFor="signup-remember" className="flex items-center gap-2 text-sm text-[var(--neutral-100)] cursor-pointer">
            <input
              id="signup-remember"
              type="checkbox"
              name="remember"
              className="size-[18px] rounded border-[var(--neutral-30)] bg-[var(--neutral-10)] text-[var(--primary-main)] focus:ring-2 focus:ring-[var(--primary-main)] focus:ring-offset-0"
            />
            Remember me
          </label>
        </div>

        <div className="space-y-4">
          <Button
            type="submit"
            disabled={loading}
            className="h-[41px] w-full rounded-[10px] bg-[var(--primary-main)] text-sm font-medium text-white shadow-[6px_6px_32px_0_rgba(0,0,0,0.06)] hover:bg-[var(--primary-hover)]"
          >
            {loading ? 'Creating...' : 'Create Account'}
          </Button>

          <p className="text-center text-sm text-[var(--neutral-60)]">
            Don&apos;t Have an Account?{' '}
            <Link href="/login" className="font-medium text-[var(--primary-main)]">
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
