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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-lg w-full text-center space-y-5">
        {/* Icon with animated glow */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
            <div className="relative bg-card rounded-full p-6 shadow-xl border">
              <ShieldAlert className="w-16 h-16 text-primary" />
            </div>
          </div>
        </div>

        {/* Title & description */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Rate Limit Exceeded
          </h1>
          <p className="text-muted-foreground">
            Too many requests have been made in a short period
          </p>
        </div>

        {/* Countdown timer card */}
        <div className="bg-card border rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-center gap-3">
            <Clock className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground uppercase tracking-wider">
              {canRetry ? 'Ready to retry' : 'Please wait'}
            </span>
          </div>

          {/* Circular progress indicator */}
          <div className="flex justify-center">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 128 128">
                {/* Background circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted"
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
                  className="text-primary transition-all duration-1000 ease-linear"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-foreground font-mono">
                  {canRetry ? '✓' : formatCountdown(countdown)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-muted border rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">
                Why am I seeing this?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                To ensure fair usage and system stability, request rates are
                limited. This protection helps maintain optimal performance
                for all users.
              </p>
            </div>
          </div>
        </div>

        {/* Retry button */}
        <div className="space-y-2">
          <Button
            onClick={handleRetry}
            className="w-full"
            variant={canRetry ? 'default' : 'secondary'}
            disabled={!canRetry}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${canRetry ? 'animate-none' : ''}`} />
            {canRetry ? 'Try Again' : `Wait ${formatCountdown(countdown)}...`}
          </Button>

          <p className="text-xs text-muted-foreground">
            The button will become available once the cooldown period ends
          </p>
        </div>

        {/* Enterprise footer */}
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            If you believe this is an error, please contact your system administrator
          </p>
        </div>
      </div>
    </div>
  )
}
