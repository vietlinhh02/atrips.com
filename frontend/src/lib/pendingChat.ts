/**
 * Utility to handle pending chat message from guest mode
 * Stores message in sessionStorage and processes it after login
 */

import aiConversationService from '@/src/services/aiConversationService';
import { chatMessageSchema, redirectUrlSchema } from '@/src/lib/validation/schemas';
import { sanitizeHtml } from '@/src/lib/sanitize';

const PENDING_MESSAGE_KEY = 'pendingChatMessage';

/**
 * Save a pending chat message to sessionStorage
 * Validates and sanitizes the message before storing
 */
export function savePendingMessage(message: string): void {
  if (typeof window !== 'undefined' && message.trim()) {
    try {
      // Validate message
      const validated = chatMessageSchema.parse(message.trim());
      // Sanitize HTML from message
      const sanitized = sanitizeHtml(validated);
      sessionStorage.setItem(PENDING_MESSAGE_KEY, sanitized);
    } catch (error) {
      console.error('Invalid message, not saving to sessionStorage:', error);
      // Don't store invalid messages
    }
  }
}

/**
 * Get and clear the pending chat message from sessionStorage
 * Validates retrieved message as defense in depth
 */
export function getPendingMessage(): string | null {
  if (typeof window === 'undefined') return null;
  const message = sessionStorage.getItem(PENDING_MESSAGE_KEY);
  if (!message) return null;

  try {
    // Validate retrieved message (defense in depth)
    const validated = chatMessageSchema.parse(message);
    return validated;
  } catch (error) {
    console.error('Invalid message in sessionStorage, clearing:', error);
    // Clear invalid messages automatically
    clearPendingMessage();
    return null;
  }
}

/**
 * Clear the pending chat message from sessionStorage
 */
export function clearPendingMessage(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(PENDING_MESSAGE_KEY);
  }
}

/**
 * Check if there's a pending chat message
 */
export function hasPendingMessage(): boolean {
  if (typeof window === 'undefined') return false;
  const message = sessionStorage.getItem(PENDING_MESSAGE_KEY);
  return !!message && message.trim().length > 0;
}

/**
 * Process pending chat message after login
 * Creates a conversation and returns the URL to redirect to
 */
export async function processPendingChatMessage(): Promise<string | null> {
  const message = getPendingMessage();
  if (!message) return null;

  try {
    // Sanitize title before creating conversation
    const sanitizedTitle = sanitizeHtml(message.substring(0, 40) + (message.length > 40 ? '...' : ''));

    // Create a new conversation with the pending message as title
    const conversation = await aiConversationService.createConversation({
      title: sanitizedTitle,
    });

    if (conversation?.id) {
      // Clear the pending message
      clearPendingMessage();

      // Return the chat URL with the message as query param
      // URL encoding is sufficient here as the receiving page will validate
      const encodedMessage = encodeURIComponent(message);
      return `/chat/${conversation.id}?q=${encodedMessage}`;
    }
  } catch (error) {
    console.error('Failed to process pending chat message:', error);
  }

  return null;
}

/**
 * Get redirect path after login, considering pending chat message
 * Priority: pending chat > original redirect > default
 * CRITICAL: Validates redirect URLs to prevent open redirect attacks
 */
export async function getPostLoginRedirect(defaultRedirect: string = '/'): Promise<string> {
  // First check for pending chat message (highest priority)
  if (hasPendingMessage()) {
    const chatUrl = await processPendingChatMessage();
    if (chatUrl) return chatUrl;
  }

  // Then check for original redirect from URL
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    if (redirect) {
      try {
        // CRITICAL: Validate redirect URL to prevent open redirect attacks
        // Only allow relative URLs starting with / (not //)
        const validatedRedirect = redirectUrlSchema.parse(redirect);
        return validatedRedirect;
      } catch (error) {
        console.error('Invalid redirect URL, using default:', error);
        // Fall through to default redirect if validation fails
      }
    }
  }

  return defaultRedirect;
}
