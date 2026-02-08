import { type ReactNode } from 'react'
import { usePermissions } from '../contexts/PermissionContext'
import { AccessDeniedPage } from './AccessDeniedPage'
import { Loader2 } from 'lucide-react'

interface PermissionRouteProps {
  /** The permission required to view this route */
  permission?: string
  /** Alternative: any of these permissions grants access */
  anyPermission?: string[]
  /** The component to render when permission is granted */
  children: ReactNode
}

/**
 * Route guard component that checks if the user has the required permission(s).
 * 
 * Usage:
 * ```tsx
 * <Route path="/radius/users" element={
 *   <PermissionRoute permission="radius.users.view">
 *     <RadiusUsers />
 *   </PermissionRoute>
 * } />
 * ```
 */
export function PermissionRoute({ permission, anyPermission, children }: PermissionRouteProps) {
  const { hasPermission, hasAnyPermission, loading, isSuperAdmin } = usePermissions()

  // While loading, show a spinner
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Super admins bypass all checks
  if (isSuperAdmin) {
    return <>{children}</>
  }

  // No permission required — just render
  if (!permission && !anyPermission) {
    return <>{children}</>
  }

  // Check specific permission
  if (permission && hasPermission(permission)) {
    return <>{children}</>
  }

  // Check any of the listed permissions
  if (anyPermission && hasAnyPermission(anyPermission)) {
    return <>{children}</>
  }

  // Permission denied
  return <AccessDeniedPage permission={permission || anyPermission?.join(', ')} />
}
