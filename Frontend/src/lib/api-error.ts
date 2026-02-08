import type { AxiosError } from 'axios'
import { toast } from 'sonner'

interface ApiErrorResponse {
  message?: string
  error?: string
  title?: string
  status?: number
}

/**
 * Enterprise-grade API error handler.
 * Extracts the most meaningful error message from an Axios error
 * and shows it as a toast notification with appropriate styling.
 *
 * Usage:
 * ```ts
 * useMutation({
 *   mutationFn: () => api.createUser(data),
 *   onError: (error) => handleApiError(error, 'Failed to create user'),
 * })
 * ```
 */
export function handleApiError(error: unknown, fallbackMessage?: string): string {
  const axiosError = error as AxiosError<ApiErrorResponse>
  const status = axiosError?.response?.status
  const data = axiosError?.response?.data

  // Extract the most specific message available
  let message = data?.message || data?.error || data?.title || ''

  // Permission denied — show specific toast style
  if (status === 403) {
    message = message || 'You do not have permission to perform this action.'
    toast.error('Permission Denied', { description: message })
    return message
  }

  // Unauthorized — session may have expired
  if (status === 401) {
    message = 'Your session has expired. Please log in again.'
    toast.error('Session Expired', { description: message })
    return message
  }

  // Not found
  if (status === 404) {
    message = message || 'The requested resource was not found.'
    toast.error(fallbackMessage || 'Not Found', { description: message })
    return message
  }

  // Validation errors (422 or 400)
  if (status === 400 || status === 422) {
    message = message || 'Please check your input and try again.'
    toast.error(fallbackMessage || 'Validation Error', { description: message })
    return message
  }

  // Rate limited
  if (status === 429) {
    // Handled by global interceptor — don't double-toast
    return 'Too many requests. Please wait.'
  }

  // Server error
  if (status && status >= 500) {
    message = message || 'An unexpected server error occurred. Please try again later.'
    toast.error(fallbackMessage || 'Server Error', { description: message })
    return message
  }

  // Network error
  if (axiosError?.code === 'ERR_NETWORK' || axiosError?.code === 'ERR_CONNECTION_REFUSED') {
    message = 'Unable to connect to the server. Please check your connection.'
    toast.error('Connection Error', { description: message })
    return message
  }

  // Fallback
  message = message || fallbackMessage || 'An unexpected error occurred.'
  toast.error(fallbackMessage || 'Error', { description: message })
  return message
}

/**
 * Type-safe check: is this a 403 Forbidden error?
 */
export function isForbiddenError(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 403
}

/**
 * Type-safe check: is this a 401 Unauthorized error?
 */
export function isUnauthorizedError(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 401
}
