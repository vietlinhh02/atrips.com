import Link from 'next/link';

export default function AuthFooter() {
  return (
    <p className="text-center text-xs leading-relaxed text-[var(--neutral-60)]">
      By continuing, you agree to TripMind&apos;s{' '}
      <Link
        href="/terms"
        className="font-medium text-[var(--neutral-100)] transition-colors hover:text-[var(--primary-main)] hover:underline hover:underline-offset-2"
      >
        Terms of Service
      </Link>{' '}
      and{' '}
      <Link
        href="/privacy"
        className="font-medium text-[var(--neutral-100)] transition-colors hover:text-[var(--primary-main)] hover:underline hover:underline-offset-2"
      >
        Privacy Policy
      </Link>
      .
    </p>
  );
}
