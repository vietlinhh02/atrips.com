import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes HTML by stripping all HTML tags
 * Use this for plain text fields where HTML should never be allowed
 */
export function sanitizeHtml(input: string): string {
  // Strip all HTML tags
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}

/**
 * Sanitizes markdown/HTML to allow only safe markdown elements
 * Use this for rich text fields where markdown rendering is expected
 */
export function sanitizeMarkdown(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'code',
      'pre',
      'ul',
      'ol',
      'li',
      'a',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'hr',
      'del',
      'ins',
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitizes URLs to block dangerous protocols
 * Allows http, https, mailto, and relative URLs only
 */
export function sanitizeUrl(url: string): string {
  const trimmedUrl = url.trim();

  // Block javascript:, data:, vbscript: URIs
  const lowerUrl = trimmedUrl.toLowerCase();
  if (
    lowerUrl.startsWith('javascript:') ||
    lowerUrl.startsWith('data:') ||
    lowerUrl.startsWith('vbscript:') ||
    lowerUrl.startsWith('file:')
  ) {
    return '#';
  }

  // Allow http, https, mailto, and relative URLs
  if (
    trimmedUrl.startsWith('http://') ||
    trimmedUrl.startsWith('https://') ||
    trimmedUrl.startsWith('mailto:') ||
    trimmedUrl.startsWith('/') ||
    trimmedUrl.startsWith('#')
  ) {
    return trimmedUrl;
  }

  // For relative URLs without leading slash, add it
  if (!trimmedUrl.includes(':')) {
    return trimmedUrl;
  }

  // Block everything else
  return '#';
}

/**
 * Escapes HTML entities to prevent XSS
 * Use this when you need to display user input as text
 */
export function escapeHtml(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * Escapes HTML entities (server-safe version)
 * Works in both browser and server environments
 */
export function escapeHtmlSafe(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
