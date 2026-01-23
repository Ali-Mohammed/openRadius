import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useKeycloak } from '../../contexts/KeycloakContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useQuery } from '@tanstack/react-query'
import { Header } from '../../components/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/skeleton'
import { Badge } from '../../components/ui/badge'
import { usersApi } from '../../lib/api'

export default function Dashboard() {
  const { keycloak } = useKeycloak()
  const { t } = useTranslation()

  // Fetch current user data
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: usersApi.getCurrentUser,
    enabled: !!keycloak.token,
  })

  // Fetch all users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAllUsers,
    enabled: !!keycloak.token,
  })

  return (
    <>
      {/* <Header /> */}
      
      <main className="space-y-8">
        <h1 className="text-4xl font-bold">{t('dashboard.title')}</h1>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.userInfo')}</CardTitle>
            <CardDescription>{t('dashboard.userInfoDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingUser ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="space-y-2 mt-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-40 w-full" />
                </div>
              </div>
            ) : userData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('user.name')}</p>
                    <p className="font-medium">{userData.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('user.email')}</p>
                    <p className="font-medium">{userData.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('user.authenticated')}</p>
                    <p className="font-medium">{userData.isAuthenticated ? t('user.yes') : t('user.no')}</p>
                  </div>
                </div>

                {userData.roles && userData.roles.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold mb-2">Roles:</p>
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
                  <div className="mt-4">
                    <p className="text-sm font-semibold mb-2">Groups:</p>
                    <div className="flex flex-wrap gap-2">
                      {userData.groups.map((group: string, index: number) => (
                        <Badge key={index} variant="success">
                          {group}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-semibold hover:text-primary">
                      {t('user.tokenClaims')} ▼
                    </summary>
                    <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded overflow-auto max-h-60 text-sm">
                      {JSON.stringify(userData.claims, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.usersList')}</CardTitle>
            <CardDescription>{t('dashboard.usersListDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
              <div className="space-y-3">
                <div className="flex gap-4">
                  <Skeleton className="h-10 w-16" />
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                </div>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 flex-1" />
                    <Skeleton className="h-8 flex-1" />
                    <Skeleton className="h-8 flex-1" />
                  </div>
                ))}
              </div>
            ) : users.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">{t('user.id')}</th>
                      <th className="text-left p-2">{t('user.email')}</th>
                      <th className="text-left p-2">{t('user.firstName')}</th>
                      <th className="text-left p-2">{t('user.lastName')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b">
                        <td className="p-2">{user.id}</td>
                        <td className="p-2">{user.email}</td>
                        <td className="p-2">{user.firstName}</td>
                        <td className="p-2">{user.lastName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>{t('dashboard.noUsers')}</p>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
