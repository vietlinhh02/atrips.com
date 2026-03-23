/**
 * Format time ago in Vietnamese
 * @param date - Date string or Date object
 * @returns Formatted time string (e.g., "5 phút trước", "2 giờ trước")
 */
export function formatTimeAgo(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Vừa xong';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} phút trước`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} giờ trước`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} ngày trước`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} tuần trước`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} tháng trước`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} năm trước`;
}

/**
 * Format date to Vietnamese locale
 * @param date - Date string or Date object
 * @param options - Intl.DateTimeFormat options
 */
export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('vi-VN', options);
}

/**
 * Format date and time to Vietnamese locale
 * @param date - Date string or Date object
 */
export function formatDateTime(date: string | Date): string {
  const dateObj = new Date(date);
  return dateObj.toLocaleString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
