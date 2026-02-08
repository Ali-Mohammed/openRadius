import { ShieldX, ArrowLeft, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface AccessDeniedPageProps {
  /** Optional specific permission that was denied */
  permission?: string
  /** Optional custom message */
  message?: string
}

/**
 * Full-page 403 Forbidden / Access Denied component.
 * Shown when a user tries to access a resource they lack permission for.
 */
export function AccessDeniedPage({ permission, message }: AccessDeniedPageProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      {/* Icon */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-destructive/10 blur-xl scale-150" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-12 w-12 text-destructive" />
        </div>
      </div>

      {/* Title & Description */}
      <div className="text-center space-y-2 max-w-md">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('errors.accessDenied', 'Access Denied')}
        </h1>
        <p className="text-muted-foreground">
          {message || t(
            'errors.accessDeniedDescription',
            "You don't have permission to access this resource. Contact your administrator if you believe this is an error."
          )}
        </p>
        {permission && (
          <p className="text-xs text-muted-foreground/70 font-mono mt-2">
            Required permission: {permission}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-2">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.goBack', 'Go Back')}
        </Button>
        <Button onClick={() => navigate('/dashboard')}>
          <Home className="mr-2 h-4 w-4" />
          {t('common.goToDashboard', 'Go to Dashboard')}
        </Button>
      </div>
    </div>
  )
}
