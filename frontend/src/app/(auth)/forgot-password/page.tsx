'use client';

import { useState } from 'react';
import { ArrowLeft, LockKey } from '@phosphor-icons/react/dist/ssr';
import api from '@/src/lib/api';
import BrandHeader from '@/src/components/common/brand/BrandHeader';
import AuthFooter from '@/src/components/common/layout/AuthFooter';
import Link from 'next/link';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import AuthRedirectRoute from '@/src/components/features/auth/AuthRedirectRoute';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;

        setIsLoading(true);
        setErrorMessage(null);

        try {
            await api.post('/auth/request-password-reset', { email });
            setIsSuccess(true);
        } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            const data = error.response?.data;
            const rawError = data?.error;
            const message = typeof rawError === 'string'
                ? rawError
                : rawError?.message || 'Failed to send reset email';
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
        if (errorMessage) setErrorMessage(null);
    };

    return (
        <AuthRedirectRoute>
            <div className="mx-auto flex w-full max-w-[327px] flex-col gap-6 sm:max-w-[420px] sm:gap-8 lg:max-w-[564px] lg:gap-[40px]">
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
                                Forgot Password
                            </h1>
                        </div>
                        <p className="text-sm text-[var(--neutral-60)] leading-relaxed">
                            Enter the email address associated with your account and we&apos;ll send you a link to reset your password.
                        </p>
                    </div>
                </div>

                {isSuccess ? (
                    <div className="rounded-[16px] bg-[var(--success-surface)] p-6 border border-[var(--success-border)] text-center space-y-4">
                        <h3 className="text-lg font-medium text-[var(--neutral-100)]">Check your email</h3>
                        <p className="text-sm text-[var(--neutral-60)]">
                            We have sent a password reset link to <span className="font-medium text-[var(--neutral-100)]">{email}</span>.
                        </p>
                        <Button
                            onClick={() => setIsSuccess(false)}
                            variant="outline"
                            className="w-full mt-4"
                        >
                            Try another email
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-[var(--neutral-100)]">
                                Email Address
                            </label>
                            <div className="space-y-2">
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={handleEmailChange}
                                    placeholder="ex: vanuel010@gmail.com"
                                    className={`h-[48px] rounded-[10px] bg-[var(--neutral-10)] px-3 text-sm transition-all duration-200 outline-none ${errorMessage
                                        ? 'border-red-500 ring-2 ring-red-500/20'
                                        : 'border-[var(--neutral-30)] hover:border-[var(--neutral-40)] focus:border-[var(--primary-main)] focus:ring-2 focus:ring-[var(--primary-main)]/20'
                                        }`}
                                    required
                                    disabled={isLoading}
                                    autoFocus
                                />
                                {errorMessage && (
                                    <p className="text-sm font-medium text-red-500 animate-in fade-in slide-in-from-top-1">
                                        {errorMessage}
                                    </p>
                                )}
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading || !email}
                            className="h-[48px] w-full rounded-[10px] bg-[var(--primary-main)] text-sm font-medium text-white shadow-[6px_6px_32px_0_rgba(0,0,0,0.06)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Sending...
                                </span>
                            ) : (
                                'Send Reset Link'
                            )}
                        </Button>
                    </form>
                )}

                <AuthFooter />
            </div>
        </AuthRedirectRoute>
    );
}
