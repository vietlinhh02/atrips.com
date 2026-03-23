import { z } from 'zod';

/**
 * Validation schema for redirect URLs
 * Only allows relative URLs starting with / (but not //)
 * Blocks absolute URLs and javascript: URIs
 */
export const redirectUrlSchema = z
  .string()
  .refine(
    (url) => {
      // Must start with / but not //
      if (!url.startsWith('/') || url.startsWith('//')) {
        return false;
      }
      // Block javascript:, data:, vbscript: URIs
      const lowerUrl = url.toLowerCase();
      if (
        lowerUrl.includes('javascript:') ||
        lowerUrl.includes('data:') ||
        lowerUrl.includes('vbscript:')
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'Invalid redirect URL. Only relative URLs starting with / are allowed.',
    }
  );

/**
 * Validation schema for chat messages
 * Limits length and blocks dangerous patterns
 */
export const chatMessageSchema = z
  .string()
  .min(1, 'Message cannot be empty')
  .max(10000, 'Message is too long (max 10000 characters)')
  .refine(
    (msg) => {
      // Block script tags
      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes('<script')) {
        return false;
      }
      // Block event handlers
      const dangerousPatterns = [
        'onerror=',
        'onload=',
        'onclick=',
        'onmouseover=',
        'onfocus=',
        'onblur=',
      ];
      return !dangerousPatterns.some((pattern) =>
        lowerMsg.includes(pattern.toLowerCase())
      );
    },
    {
      message: 'Message contains potentially dangerous content',
    }
  );

/**
 * Validation schema for URL query parameters
 * Similar to chat messages but allows wider character range
 */
export const queryParamSchema = z
  .string()
  .max(2000, 'Query parameter is too long')
  .refine(
    (param) => {
      const lowerParam = param.toLowerCase();
      // Block script tags and event handlers
      if (lowerParam.includes('<script')) {
        return false;
      }
      const dangerousPatterns = [
        'onerror=',
        'onload=',
        'onclick=',
        'onmouseover=',
      ];
      return !dangerousPatterns.some((pattern) =>
        lowerParam.includes(pattern.toLowerCase())
      );
    },
    {
      message: 'Query parameter contains potentially dangerous content',
    }
  );

/**
 * Email validation schema
 */
export const emailSchema = z.string().email('Invalid email address');

/**
 * Password validation schema
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

/**
 * Generic string schema for user inputs
 */
export const safeStringSchema = z
  .string()
  .max(1000, 'Input is too long')
  .refine(
    (str) => {
      const lowerStr = str.toLowerCase();
      return !lowerStr.includes('<script');
    },
    {
      message: 'Input contains potentially dangerous content',
    }
  );
