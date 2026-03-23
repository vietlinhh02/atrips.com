"use client"

import { toast as sonnerToast } from "sonner"

/**
 * Toast wrapper using sonner with custom colors from globals.css
 */

/**
 * Show a success toast
 */
function success(title: string, description?: string, duration?: number) {
  sonnerToast.success(title, {
    description,
    duration: duration || 4000,
  })
}

/**
 * Show an error toast
 */
function error(title: string, description?: string, duration?: number) {
  sonnerToast.error(title, {
    description,
    duration: duration || 4000,
  })
}

/**
 * Show a warning toast
 */
function warning(title: string, description?: string, duration?: number) {
  sonnerToast.warning(title, {
    description,
    duration: duration || 4000,
  })
}

/**
 * Show an info toast
 */
function info(title: string, description?: string, duration?: number) {
  sonnerToast.info(title, {
    description,
    duration: duration || 4000,
  })
}

/**
 * Toast object with methods for backward compatibility
 */
export const toast = {
  success,
  error,
  warning,
  info,
}

/**
 * Hook for using toast in components (for backward compatibility)
 */
export function useToast() {
  return toast
}
