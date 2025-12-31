import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useKeycloak } from '../contexts/KeycloakContext'
import { useTheme } from '../contexts/ThemeContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Header } from '../components/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Skeleton } from '../components/ui/skeleton'
import { Badge } from '../components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { usersApi } from '../lib/api'
import { User, Lock, Shield, Bell, ArrowLeft, Save, AlertTriangle } from 'lucide-react'

type TabType = 'personal' | 'password' | 'security' | 'notifications'

export default function ProfileSettings() {
  const { keycloak } = useKeycloak()
  const { t } = useTranslation()
  const { layout } = useTheme()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('personal')

  // Fetch current user data
  const { data: userData, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: usersApi.getCurrentUser,
    enabled: !!keycloak.token,
  })

  // Fetch all users to get database profile
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAllUsers,
    enabled: !!keycloak.token,
  })

  const email = keycloak.tokenParsed?.email
  const dbUser = users.find((u: any) => u.email === email)

  // Personal Information State
  const [personalInfo, setPersonalInfo] = useState({
    firstName: dbUser?.firstName || keycloak.tokenParsed?.given_name || '',
    lastName: dbUser?.lastName || keycloak.tokenParsed?.family_name || '',
    email: email || '',
  })

  // Password State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: usersApi.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    },
  })

  const handlePersonalInfoUpdate = () => {
    updateProfileMutation.mutate({
      firstName: personalInfo.firstName,
      lastName: personalInfo.lastName,
    })
  }

  const handleUpdateKeycloakProfile = () => {
    // Open Keycloak account management to update profile there
    keycloak.accountManagement()
  }

  const handlePasswordChange = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Passwords do not match')
      return
    }
    // Password change would be handled by Keycloak
    keycloak.accountManagement()
  }

  // Update form when user data loads
  useEffect(() => {
    if (dbUser) {
      setPersonalInfo({
        firstName: dbUser.firstName || '',
        lastName: dbUser.lastName || '',
        email: email || '',
      })
    } else if (keycloak.tokenParsed) {
      setPersonalInfo({
        firstName: keycloak.tokenParsed.given_name || '',
        lastName: keycloak.tokenParsed.family_name || '',
        email: email || '',
      })
    }
  }, [dbUser, keycloak.tokenParsed, email])

  return (
    <>      
      <main className={`${layout === 'full-width' ? 'w-full' : 'max-w-7xl mx-auto'} px-6 py-8 space-y-6`}>
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t('profile.settings')}</h1>
            <p className="text-muted-foreground">{t('profile.manageAccount')}</p>
          </div>
        </div>

        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="personal" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{t('profile.personalInfo')}</span>
            </TabsTrigger>
            <TabsTrigger value="password" className="gap-2">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">{t('profile.changePassword')}</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">{t('profile.security')}</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">{t('profile.notifications')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Personal Information Tab */}
          <TabsContent value="personal">
            {isLoading ? (
              <Card>
                <CardContent className="p-6 space-y-4">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>{t('profile.personalInfo')}</CardTitle>
                  <CardDescription>{t('profile.updatePersonalInfo')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">{t('user.firstName')}</Label>
                      <Input
                        id="firstName"
                        value={personalInfo.firstName}
                        onChange={(e) =>
                          setPersonalInfo({ ...personalInfo, firstName: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">{t('user.lastName')}</Label>
                      <Input
                        id="lastName"
                        value={personalInfo.lastName}
                        onChange={(e) =>
                          setPersonalInfo({ ...personalInfo, lastName: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{t('user.email')}</Label>
                    <Input
                      id="email"
                      type="email"
                          value={personalInfo.email}
                          disabled
                          className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('profile.emailCannotChange')}
                        </p>
                      </div>

                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                              {t('profile.keycloakProfileNote')}
                            </h4>
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                              {t('profile.keycloakProfileDesc')}
                            </p>
                          </div>
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={handleUpdateKeycloakProfile}
                            className="shrink-0"
                          >
                            {t('profile.updateInKeycloak')}
                          </Button>
                        </div>
                      </div>

                      {userData && (
                        <div className="space-y-4 pt-4 border-t">
                          <h3 className="font-semibold">{t('profile.accountInfo')}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">{t('user.authenticated')}</p>
                              <p className="font-medium">
                                {userData.isAuthenticated ? t('user.yes') : t('user.no')}
                              </p>
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
                          </div>
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
                        </div>
                      )}

                      <div className="flex justify-end pt-4">
                        <Button
                          onClick={handlePersonalInfoUpdate}
                          disabled={updateProfileMutation.isPending}
                          className="gap-2"
                        >
                          <Save className="h-4 w-4" />
                          {updateProfileMutation.isPending ? t('common.loading') : t('user.saveChanges')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Change Password Tab */}
              <TabsContent value="password">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('profile.changePassword')}</CardTitle>
                      <CardDescription>{t('profile.updatePassword')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="currentPassword">{t('profile.currentPassword')}</Label>
                          <Input
                            id="currentPassword"
                            type="password"
                            value={passwordData.currentPassword}
                            onChange={(e) =>
                              setPasswordData({ ...passwordData, currentPassword: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="newPassword">{t('profile.newPassword')}</Label>
                          <Input
                            id="newPassword"
                            type="password"
                            value={passwordData.newPassword}
                            onChange={(e) =>
                              setPasswordData({ ...passwordData, newPassword: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword">{t('profile.confirmPassword')}</Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            value={passwordData.confirmPassword}
                            onChange={(e) =>
                              setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <Alert variant="info">
                        <AlertDescription>
                          {t('profile.passwordManagedByKeycloak')}
                        </AlertDescription>
                      </Alert>

                      <div className="flex justify-end pt-4">
                        <Button onClick={handlePasswordChange} className="gap-2">
                          <Lock className="h-4 w-4" />
                          {t('profile.openKeycloakAccount')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('profile.security')}</CardTitle>
                      <CardDescription>{t('profile.manageSecurity')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h4 className="font-medium">{t('profile.twoFactor')}</h4>
                            <p className="text-sm text-muted-foreground">
                              {t('profile.twoFactorDesc')}
                            </p>
                          </div>
                          <Button variant="default" onClick={() => keycloak.accountManagement()}>
                            {t('profile.configure')}
                          </Button>
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h4 className="font-medium">{t('profile.activeSessions')}</h4>
                            <p className="text-sm text-muted-foreground">
                              {t('profile.activeSessionsDesc')}
                            </p>
                          </div>
                          <Button variant="default" onClick={() => keycloak.accountManagement()}>
                            {t('profile.viewSessions')}
                          </Button>
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h4 className="font-medium">{t('profile.loginHistory')}</h4>
                            <p className="text-sm text-muted-foreground">
                              {t('profile.loginHistoryDesc')}
                            </p>
                          </div>
                          <Button variant="default" onClick={() => keycloak.accountManagement()}>
                            {t('profile.viewHistory')}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('profile.notifications')}</CardTitle>
                      <CardDescription>{t('profile.manageNotifications')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h4 className="font-medium">{t('profile.emailNotifications')}</h4>
                            <p className="text-sm text-muted-foreground">
                              {t('profile.emailNotificationsDesc')}
                            </p>
                          </div>
                          <Button variant="default">{t('profile.comingSoon')}</Button>
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h4 className="font-medium">{t('profile.systemAlerts')}</h4>
                            <p className="text-sm text-muted-foreground">
                              {t('profile.systemAlertsDesc')}
                            </p>
                          </div>
                          <Button variant="default">{t('profile.comingSoon')}</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
        </Tabs>
      </main>
    </>
  )
}
