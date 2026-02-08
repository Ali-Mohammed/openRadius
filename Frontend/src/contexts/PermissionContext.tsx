import React, { createContext, useContext, useCallback, useEffect, useState, useMemo, type ReactNode } from 'react'
import { navigationApi } from '../api/navigationApi'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PermissionContextValue {
  /** The user's granted permissions (e.g. ["radius.users.view", "radius.users.create"]) */
  permissions: string[]
  /** Whether the current user is a super-admin (bypasses all permission checks) */
  isSuperAdmin: boolean
  /** True while permissions are being fetched */
  loading: boolean
  /** Check if the user has a specific permission */
  hasPermission: (permission: string) => boolean
  /** Check if the user has ANY of the given permissions */
  hasAnyPermission: (permissions: string[]) => boolean
  /** Check if the user has ALL of the given permissions */
  hasAllPermissions: (permissions: string[]) => boolean
  /** Force a re-fetch of permissions (e.g. after role change) */
  refreshPermissions: () => Promise<void>
}

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PermissionProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<string[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true)
      const response = await navigationApi.getMenu()
      setPermissions(response.permissions ?? [])
      setIsSuperAdmin(response.isSuperAdmin ?? false)
    } catch (error) {
      console.error('Failed to load permissions:', error)
      setPermissions([])
      setIsSuperAdmin(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  // Listen for custom permission-refresh events (e.g. after role assignment)
  useEffect(() => {
    const handler = () => fetchPermissions()
    window.addEventListener('permissions-changed', handler)
    window.addEventListener('workspace-changed', handler)
    return () => {
      window.removeEventListener('permissions-changed', handler)
      window.removeEventListener('workspace-changed', handler)
    }
  }, [fetchPermissions])

  // Pre-compute a Set for O(1) lookups
  const permissionSet = useMemo(() => new Set(permissions), [permissions])

  const hasPermission = useCallback(
    (permission: string) => isSuperAdmin || permissionSet.has(permission),
    [isSuperAdmin, permissionSet]
  )

  const hasAnyPermission = useCallback(
    (perms: string[]) => isSuperAdmin || perms.some(p => permissionSet.has(p)),
    [isSuperAdmin, permissionSet]
  )

  const hasAllPermissions = useCallback(
    (perms: string[]) => isSuperAdmin || perms.every(p => permissionSet.has(p)),
    [isSuperAdmin, permissionSet]
  )

  const value = useMemo<PermissionContextValue>(() => ({
    permissions,
    isSuperAdmin,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions: fetchPermissions,
  }), [permissions, isSuperAdmin, loading, hasPermission, hasAnyPermission, hasAllPermissions, fetchPermissions])

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePermissions() {
  const context = useContext(PermissionContext)
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider')
  }
  return context
}
