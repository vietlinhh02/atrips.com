interface LoadingScreenProps {
    message?: string;
    fullScreen?: boolean;
}

export default function LoadingScreen({
    message = 'Loading...',
    fullScreen = true,
}: LoadingScreenProps) {
    const containerClass = fullScreen
        ? 'fixed inset-0 z-50 bg-[var(--neutral-10)]'
        : 'w-full h-full min-h-[200px]';

    return (
        <div className={`${containerClass} flex flex-col items-center justify-center`}>
            <div className="relative h-10 w-10">
                <div className="absolute inset-0 rounded-full border-[3px] border-[var(--primary-surface)] border-t-[var(--primary-main)] animate-spin" />
            </div>
            {message && (
                <p className="mt-3 text-sm text-[var(--neutral-60)]">
                    {message}
                </p>
            )}
        </div>
    );
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const sizeClass = {
        sm: 'w-5 h-5 border-2',
        md: 'w-8 h-8 border-[3px]',
        lg: 'w-12 h-12 border-[3px]',
    }[size];

    return (
        <div
            className={`${sizeClass} rounded-full border-[var(--primary-surface)] border-t-[var(--primary-main)] animate-spin`}
        />
    );
}

export function SkeletonCard() {
    return (
        <div className="w-full p-4 rounded-xl border border-[var(--neutral-30)] bg-[var(--neutral-10)]">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--neutral-20)] animate-pulse" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 bg-[var(--neutral-20)] rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-[var(--neutral-20)] rounded animate-pulse" />
                </div>
            </div>
        </div>
    );
}
