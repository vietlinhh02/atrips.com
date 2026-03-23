/**
 * Generate a consistent default avatar URL for a user.
 * Always use email as seed for consistency across the app.
 */
export function getDefaultAvatarUrl(
  email?: string | null,
  name?: string | null
): string {
  const seed = email || name || 'Atrips';
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}`;
}
