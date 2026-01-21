import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useKeycloak } from '../contexts/KeycloakContext'
import { useTheme } from '../contexts/ThemeContext'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { Badge } from '../components/ui/badge'
import { usersApi } from '../lib/api'
import { Bell, ExternalLink, UserCog, ShieldAlert } from 'lucide-react'

export default function ProfileSettings() {
  const { keycloak } = useKeycloak()
  const { t } = useTranslation()
  const { layout } = useTheme()
  const [impersonationData, setImpersonationData] = useState<any>(null)

  useEffect(() => {
    // Check if in impersonation mode
    const impersonationStr = sessionStorage.getItem('impersonation')
    if (impersonationStr) {
      try {
        setImpersonationData(JSON.parse(impersonationStr))
      } catch (e) {
        sessionStorage.removeItem('impersonation')
      }
    }
  }, [])

  const isImpersonating = !!impersonationData

  // Fetch current user data
  const { data: userData, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: usersApi.getCurrentUser,
    enabled: !!keycloak.token,
  })

  // Get display values based on impersonation status
  const getDisplayName = () => {
    if (isImpersonating && impersonationData?.impersonatedUser) {
      return `${impersonationData.impersonatedUser.firstName} ${impersonationData.impersonatedUser.lastName}`
    }
    return `${keycloak.tokenParsed?.given_name || ''} ${keycloak.tokenParsed?.family_name || ''}`
  }

  const getDisplayEmail = () => {
    if (isImpersonating && impersonationData?.impersonatedUser) {
      return impersonationData.impersonatedUser.email
    }
    return keycloak.tokenParsed?.email
  }

  const getDisplayFirstName = () => {
    if (isImpersonating && impersonationData?.impersonatedUser) {
      return impersonationData.impersonatedUser.firstName
    }
    return keycloak.tokenParsed?.given_name
  }

  const getDisplayLastName = () => {
    if (isImpersonating && impersonationData?.impersonatedUser) {
      return impersonationData.impersonatedUser.lastName
    }
    return keycloak.tokenParsed?.family_name
  }

  const handleManageAccount = () => {
    const accountUrl = `${import.meta.env.VITE_KEYCLOAK_URL}/realms/${import.meta.env.VITE_KEYCLOAK_REALM}/account`
    window.open(accountUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('profile.settings')}</h1>
          <p className="text-muted-foreground">Manage application preferences</p>
        </div>
        <Button onClick={handleManageAccount} className="gap-2">
          <UserCog className="h-4 w-4" />
          Manage Account
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>

      {isImpersonating && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <ShieldAlert className="h-5 w-5" />
              <div>
                <p className="font-semibold">Impersonation Mode Active</p>
                <p className="text-sm">You are viewing this profile as an impersonated user. Original admin: {impersonationData.originalAdmin}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

        {/* Account Information */}
        {isLoading ? (
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ) : userData && (
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                {isImpersonating ? "Impersonated user's account details" : "Your account details and permissions"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">
                    {getDisplayFirstName()} {getDisplayLastName()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{getDisplayEmail()}</p>
                </div>
              </div>

              {userData.roles && userData.roles.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Roles</p>
                  <div className="flex flex-wrap gap-2">
                    {userData.roles.map((role: string, index: number) => (
                      <Badge key={index} variant="default">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {userData.groups && userData.groups.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Groups</p>
                  <div className="flex flex-wrap gap-2">
                    {userData.groups.map((group: string, index: number) => (
                      <Badge key={index} variant="success">
                        {group}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  To update your personal information, password, enable 2FA, or manage security settings, use the account management portal.
                </p>
                <Button onClick={handleManageAccount} variant="outline" className="gap-2">
                  <UserCog className="h-4 w-4" />
                  Open Account Management
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notifications Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t('profile.notifications')}
            </CardTitle>
            <CardDescription>Configure how you receive notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Email Notifications</h4>
                  <p className="text-sm text-muted-foreground">
                    Receive email updates about important events
                  </p>
                </div>
                <Button variant="outline" disabled>Coming Soon</Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">System Alerts</h4>
                  <p className="text-sm text-muted-foreground">
                    Get notified about system maintenance and updates
                  </p>
                </div>
                <Button variant="outline" disabled>Coming Soon</Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Billing Alerts</h4>
                  <p className="text-sm text-muted-foreground">
                    Notifications for billing events and threshold alerts
                  </p>
                </div>
                <Button variant="outline" disabled>Coming Soon</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  )
}
