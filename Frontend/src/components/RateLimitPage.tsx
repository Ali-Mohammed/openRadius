import { useEffect, useState } from 'react'
import { ShieldAlert, RefreshCw, Clock, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RateLimitPageProps {
  retryAfter?: string
  onRetry?: () => void
}

/**
 * Parses a timespan string like "00:01:00" into total seconds.
 * Falls back to 60 seconds if parsing fails.
 */
function parseRetryAfterSeconds(retryAfter?: string): number {
  if (!retryAfter) return 60
  const parts = retryAfter.split(':')
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10) || 0
    const minutes = parseInt(parts[1], 10) || 0
    const seconds = parseInt(parts[2], 10) || 0
    return hours * 3600 + minutes * 60 + seconds
  }
  const num = parseInt(retryAfter, 10)
  return isNaN(num) ? 60 : num
}

function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  if (mins > 0) {
    return `${mins}m ${secs.toString().padStart(2, '0')}s`
  }
  return `${secs}s`
}

export function RateLimitPage({ retryAfter, onRetry }: RateLimitPageProps) {
  const totalSeconds = parseRetryAfterSeconds(retryAfter)
  const [countdown, setCountdown] = useState(totalSeconds)
  const [canRetry, setCanRetry] = useState(false)

  useEffect(() => {
    setCountdown(totalSeconds)
    setCanRetry(false)

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          setCanRetry(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [totalSeconds])

  const handleRetry = () => {
    if (onRetry) {
      onRetry()
    } else {
      window.location.reload()
    }
  }

  // Progress percentage for the circular countdown
  const progress = totalSeconds > 0 ? ((totalSeconds - countdown) / totalSeconds) * 100 : 100

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Icon with animated glow */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full animate-pulse" />
            <div className="relative bg-white dark:bg-gray-800 rounded-full p-8 shadow-xl border border-amber-200 dark:border-amber-800">
              <ShieldAlert className="w-20 h-20 text-amber-500" />
            </div>
          </div>
        </div>

        {/* Title & description */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Rate Limit Exceeded
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Too many requests have been made in a short period
          </p>
        </div>

        {/* Countdown timer card */}
        <div className="bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 rounded-xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              {canRetry ? 'Ready to retry' : 'Please wait'}
            </span>
          </div>

          {/* Circular progress indicator */}
          <div className="flex justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 128 128">
                {/* Background circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-200 dark:text-gray-700"
                />
                {/* Progress circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  className="text-amber-500 transition-all duration-1000 ease-linear"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
                  {canRetry ? '✓' : formatCountdown(countdown)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Why am I seeing this?
              </p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                To ensure fair usage and system stability, request rates are
                limited. This protection helps maintain optimal performance
                for all users.
              </p>
            </div>
          </div>
        </div>

        {/* Retry button */}
        <div className="space-y-3">
          <Button
            onClick={handleRetry}
            className={`w-full transition-all duration-300 ${
              canRetry
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-500/25'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
            size="lg"
            disabled={!canRetry}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${canRetry ? 'animate-none' : ''}`} />
            {canRetry ? 'Try Again' : `Wait ${formatCountdown(countdown)}...`}
          </Button>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            The button will become available once the cooldown period ends
          </p>
        </div>

        {/* Enterprise footer */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            If you believe this is an error, please contact your system administrator
          </p>
        </div>
      </div>
    </div>
  )
}
