'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { cn } from '@/src/lib/utils';
import { getDefaultAvatarUrl } from '@/src/lib/avatar';

interface UserAvatarProps {
  user?: {
    name?: string;
    avatarUrl?: string | null;
    email?: string;
  } | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
};

export function UserAvatar({ user, size = 'md', className }: UserAvatarProps) {
  const initials = user?.name
    ? user.name
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  const avatarSrc =
    user?.avatarUrl || getDefaultAvatarUrl(user?.email, user?.name);

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={avatarSrc} alt={user?.name || 'User'} />
      <AvatarFallback className="bg-[var(--primary-main)] text-white font-semibold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
