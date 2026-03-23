'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeSlash, LockKey } from '@phosphor-icons/react/dist/ssr';
import authService from '@/src/services/authService';
import BrandHeader from '@/src/components/common/brand/BrandHeader';
import AuthFooter from '@/src/components/common/layout/AuthFooter';
import Link from 'next/link';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import AuthRedirectRoute from '@/src/components/features/auth/AuthRedirectRoute';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const validatePasswordStrength = (pwd: string) => {
        const hasLength = pwd.length >= 8;
        const hasUpper = /[A-Z]/.test(pwd);
        const hasLower = /[a-z]/.test(pwd);
        const hasNumber = /[0-9]/.test(pwd);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
        return hasLength && hasUpper && hasLower && hasNumber && hasSpecial;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;

        if (!token) {
            setErrorMessage('Invalid or missing reset token.');
            return;
        }

        if (!validatePasswordStrength(password)) {
            setErrorMessage('Password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            await authService.resetPassword({ token, password });
            setIsSuccess(true);
        } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            const data = error.response?.data;
            const rawError = data?.error;
            const message = typeof rawError === 'string'
                ? rawError
                : rawError?.message || 'Failed to reset password';
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
        if (errorMessage) setErrorMessage(null);
    };

    if (isSuccess) {
        return (
            <div className="rounded-[16px] bg-[var(--success-surface)] p-6 border border-[var(--success-border)] text-center space-y-4">
                <h3 className="text-lg font-medium text-[var(--neutral-100)]">Password Reset Successful</h3>
                <p className="text-sm text-[var(--neutral-60)]">
                    Your password has been successfully reset. You can now login with your new password.
                </p>
                <Button
                    onClick={() => router.push('/login')}
                    className="w-full mt-4 h-[41px] rounded-[10px] bg-[var(--primary-main)] text-sm font-medium text-white hover:bg-[var(--primary-hover)]"
                >
                    Back to Login
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {!token && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                    Missing reset token. Please use the link from your email.
                </div>
            )}

            <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-[var(--neutral-100)]">
                    New Password
                </label>
                <div className="space-y-2">
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={handlePasswordChange}
                            placeholder="Enter new password"
                            className={`h-[48px] rounded-[10px] bg-[var(--neutral-10)] px-3 pr-11 text-sm transition-all duration-200 outline-none ${errorMessage
                                ? 'border-red-500 ring-2 ring-red-500/20'
                                : 'border-[var(--neutral-30)] hover:border-[var(--neutral-40)] focus:border-[var(--primary-main)] focus:ring-2 focus:ring-[var(--primary-main)]/20'
                                }`}
                            required
                            disabled={isLoading || !token}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--neutral-60)] transition hover:text-[var(--neutral-100)]"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            disabled={isLoading}
                        >
                            {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {errorMessage && (
                        <p className="text-sm font-medium text-red-500 animate-in fade-in slide-in-from-top-1">
                            {errorMessage}
                        </p>
                    )}
                    <p className="text-xs text-[var(--neutral-60)]">
                        Must be at least 8 characters with uppercase, lowercase, number, and special character.
                    </p>
                </div>
            </div>

            <Button
                type="submit"
                disabled={isLoading || !password || !token}
                className="h-[48px] w-full rounded-[10px] bg-[var(--primary-main)] text-sm font-medium text-white shadow-[6px_6px_32px_0_rgba(0,0,0,0.06)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Reseting...
                    </span>
                ) : (
                    'Reset Password'
                )}
            </Button>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <AuthRedirectRoute>
            <div className="mx-auto flex w-full max-w-[327px] flex-col gap-[32px] sm:max-w-[420px] lg:max-w-[564px] lg:gap-[40px]">
                {/* Header and Back Link */}
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
                                <LockKey size={24} weight="bold" className="text-white" />
                            </div>
                            <h1 className="text-[24px] font-medium text-[var(--neutral-100)] lg:text-[32px]">
                                Reset Password
                            </h1>
                        </div>
                        <p className="text-sm text-[var(--neutral-60)] leading-relaxed">
                            Enter a new password for your account.
                        </p>
                    </div>
                </div>

                <Suspense fallback={<div>Loading...</div>}>
                    <ResetPasswordForm />
                </Suspense>

                <AuthFooter />
            </div>
        </AuthRedirectRoute>
    );
}
