/**
 * Format a number with thousand separators
 * @param value - The number to format
 * @returns Formatted string with commas (e.g., 1000 -> 1,000)
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '0'
  }
  return value.toLocaleString('en-US')
}

/**
 * Format a date string to a localized date-time string
 * @param dateString - The date string to format
 * @returns Formatted date string or 'N/A' if invalid
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) {
    return 'N/A'
  }
  
  const date = new Date(dateString)
  
  // Check if date is invalid
  if (isNaN(date.getTime())) {
    console.warn('Invalid date string:', dateString)
    return 'N/A'
  }
  
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Format a date to a relative time string (e.g., "2 minutes ago")
 * @param dateString - The date string to format
 * @returns Relative time string or the formatted date if too old
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) {
    return 'N/A'
  }
  
  const date = new Date(dateString)
  
  // Check if date is invalid
  if (isNaN(date.getTime())) {
    console.warn('Invalid date string:', dateString)
    return 'N/A'
  }
  
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 0) {
    return 'just now'
  }
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} second${diffInSeconds !== 1 ? 's' : ''} ago`
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`
  }
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`
  }
  
  // For dates older than a week, show the actual date
  return formatDate(dateString)
}
