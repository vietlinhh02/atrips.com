'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Airplane,
  ChatCircle,
  CreditCard,
  Gear,
  Sparkle,
  Checks,
  X,
} from '@phosphor-icons/react';
import useNotificationStore from '@/src/stores/notificationStore';
import type { NotificationType } from '@/src/services/notificationService';

const ICON_MAP: Record<
  NotificationType,
  { icon: typeof Airplane; color: string; bg: string }
> = {
  TRIP_UPDATE: { icon: Airplane, color: 'text-blue-500', bg: 'bg-blue-50' },
  TRIP_INVITE: { icon: Airplane, color: 'text-blue-500', bg: 'bg-blue-50' },
  HIRE_STATUS: { icon: Gear, color: 'text-gray-500', bg: 'bg-gray-50' },
  GUIDE_MESSAGE: {
    icon: ChatCircle,
    color: 'text-purple-500',
    bg: 'bg-purple-50',
  },
  PAYMENT: {
    icon: CreditCard,
    color: 'text-green-500',
    bg: 'bg-green-50',
  },
  SYSTEM: { icon: Gear, color: 'text-gray-500', bg: 'bg-gray-50' },
  PROMOTION: { icon: Sparkle, color: 'text-amber-500', bg: 'bg-amber-50' },
};

export default function NotificationDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore();

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (open) {
      fetchNotifications({ page: 1, limit: 5 });
    }
  }, [open, fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell trigger */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="bg-[var(--neutral-10)] border border-[var(--neutral-30)] rounded-[10px] w-8 h-8 flex items-center justify-center shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)] hover:bg-[var(--neutral-20)] transition-colors shrink-0 relative"
        aria-label="Notifications"
      >
        <Bell size={16} weight="regular" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary-main)] px-1 text-[10px] font-semibold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-1/2 translate-x-1/2 top-full mt-2 w-[360px] rounded-[12px] border border-[var(--neutral-30)] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--neutral-30)]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--neutral-100)]">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary-main)] px-1.5 text-[11px] font-semibold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="flex items-center gap-1 text-xs text-[var(--primary-main)] hover:text-[var(--primary-hover)] font-medium"
              >
                <Checks size={14} weight="bold" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[340px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex flex-col gap-1 p-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg p-3 animate-pulse"
                  >
                    <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--neutral-20)]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-24 rounded bg-[var(--neutral-20)]" />
                      <div className="h-3 w-full rounded bg-[var(--neutral-20)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center py-8 px-4">
                <Bell
                  size={28}
                  weight="duotone"
                  className="text-[var(--neutral-40)] mb-2"
                />
                <span className="text-sm text-[var(--neutral-50)]">
                  No notifications yet
                </span>
              </div>
            ) : (
              <div className="flex flex-col p-1">
                {notifications.map((notification) => {
                  const config =
                    ICON_MAP[notification.type] ?? ICON_MAP.SYSTEM;
                  const IconComponent = config.icon;
                  const timeAgo = formatDistanceToNow(
                    new Date(notification.createdAt),
                    { addSuffix: true }
                  );

                  return (
                    <div
                      key={notification.id}
                      onClick={() => {
                        if (!notification.isRead) {
                          markAsRead(notification.id);
                        }
                      }}
                      className={`group relative flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-colors hover:bg-[var(--neutral-20)]/60 ${
                        !notification.isRead
                          ? 'bg-[var(--primary-main)]/[0.03]'
                          : ''
                      }`}
                    >
                      {/* Unread dot */}
                      {!notification.isRead && (
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-[var(--primary-main)]" />
                      )}

                      {/* Icon */}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.bg} ${config.color}`}
                      >
                        <IconComponent size={16} weight="fill" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <span
                          className={`text-[13px] leading-snug ${
                            notification.isRead
                              ? 'font-medium text-[var(--neutral-80)]'
                              : 'font-semibold text-[var(--neutral-100)]'
                          }`}
                        >
                          {notification.title}
                        </span>
                        <p className="mt-0.5 text-[12px] leading-snug text-[var(--neutral-60)] line-clamp-2">
                          {notification.body}
                        </p>
                        <span className="mt-1 block text-[11px] text-[var(--neutral-50)]">
                          {timeAgo}
                        </span>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        className="shrink-0 rounded-md p-1 text-[var(--neutral-40)] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--neutral-30)] hover:text-[var(--neutral-70)]"
                        aria-label="Delete notification"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--neutral-30)] px-4 py-2.5">
            <button
              onClick={() => {
                setOpen(false);
                router.push('/notifications');
              }}
              className="w-full text-center text-[13px] font-medium text-[var(--primary-main)] hover:text-[var(--primary-hover)] transition-colors"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
