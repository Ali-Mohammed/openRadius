import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { appConfig } from '@/config/app.config'
import { useTheme } from '@/contexts/ThemeContext'

interface OidcProvider {
  id: number
  providerName: string
  displayName: string
  description?: string
  logoUrl?: string
  displayOrder: number
  authority: string
  clientId: string
  isDefault: boolean
}

export default function LoginPage() {
  const [providers, setProviders] = useState<OidcProvider[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { theme, primaryColor } = useTheme()

  useEffect(() => {
    loadProviders()
  }, [])

  const loadProviders = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${appConfig.api.baseUrl}/api/oidcsettings/providers`)
      
      if (response.ok) {
        const data = await response.json()
        setProviders(data)
      } else {
        toast.error('Failed to load authentication providers')
      }
    } catch (error) {
      console.error('Error loading providers:', error)
      toast.error('Error loading authentication providers')
    } finally {
      setLoading(false)
    }
  }

  const handleProviderLogin = (provider: OidcProvider) => {
    // Store selected provider in sessionStorage
    sessionStorage.setItem('selectedOidcProvider', JSON.stringify({
      providerName: provider.providerName,
      authority: provider.authority,
      clientId: provider.clientId
    }))
    
    // Navigate to initiate OIDC flow
    window.location.href = `/?provider=${provider.providerName}`
  }

  const getProviderIcon = (providerName: string) => {
    switch (providerName.toLowerCase()) {
      case 'keycloak':
        return '🔐'
      case 'azuread':
      case 'azure':
        return '☁️'
      case 'google':
        return '🔵'
      case 'local':
        return '🏠'
      default:
        return '🔑'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-start justify-center bg-background pt-20">
        <Card className="w-full max-w-md shadow-lg border-border">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-6">
              <Skeleton className="h-28 w-28 rounded-full" />
            </div>
            <Skeleton className="h-8 w-3/4 mx-auto mb-2" />
            <Skeleton className="h-4 w-full mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-2/3 mx-auto mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
            <div className="pt-4 border-t">
              <Skeleton className="h-3 w-full mx-auto" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-background p-4 pt-20">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            <img 
              src="/src/openradius.svg" 
              alt="OpenRadius Logo" 
              className="h-28 w-28 transition-all animate-in fade-in-0 zoom-in-50 duration-700"
              style={{ 
                animation: 'float 3s ease-in-out infinite',
                filter: theme === 'dark' 
                  ? 'brightness(0) saturate(100%) invert(1)' 
                  : `brightness(0) saturate(100%) invert(${primaryColor === 'blue' ? '37%' : primaryColor === 'green' ? '58%' : primaryColor === 'purple' ? '26%' : primaryColor === 'orange' ? '60%' : primaryColor === 'red' ? '44%' : '37%'}) sepia(${primaryColor === 'blue' ? '98%' : primaryColor === 'green' ? '96%' : primaryColor === 'purple' ? '99%' : primaryColor === 'orange' ? '98%' : primaryColor === 'red' ? '89%' : '98%'}) saturate(${primaryColor === 'blue' ? '1234%' : primaryColor === 'green' ? '2067%' : primaryColor === 'purple' ? '7497%' : primaryColor === 'orange' ? '1850%' : primaryColor === 'red' ? '2374%' : '1234%'}) hue-rotate(${primaryColor === 'blue' ? '205deg' : primaryColor === 'green' ? '86deg' : primaryColor === 'purple' ? '255deg' : primaryColor === 'orange' ? '1deg' : primaryColor === 'red' ? '341deg' : '205deg'}) brightness(${primaryColor === 'blue' ? '101%' : primaryColor === 'green' ? '96%' : primaryColor === 'purple' ? '99%' : primaryColor === 'orange' ? '94%' : primaryColor === 'red' ? '95%' : '101%'}) contrast(${primaryColor === 'blue' ? '101%' : primaryColor === 'green' ? '106%' : primaryColor === 'purple' ? '110%' : primaryColor === 'orange' ? '107%' : primaryColor === 'red' ? '98%' : '101%'})`
              }}
            />
          </div>
          <CardTitle className="text-2xl animate-in fade-in-0 slide-in-from-bottom-4 duration-700 delay-150">Welcome to OpenRadius</CardTitle>
          <CardDescription className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 delay-300">
            Enterprise FreeRADIUS Billing & Management Platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No authentication providers configured. Please contact your administrator.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="text-sm text-muted-foreground text-center mb-4">
                Choose your authentication provider
              </div>
              
              <div className="space-y-3">
                {providers
                  .sort((a, b) => {
                    // Default provider first
                    if (a.isDefault) return -1
                    if (b.isDefault) return 1
                    // Then by display order
                    return a.displayOrder - b.displayOrder
                  })
                  .map((provider) => (
                    <Button
                      key={provider.id}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-4 hover:bg-accent hover:text-accent-foreground"
                      onClick={() => handleProviderLogin(provider)}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="text-2xl">
                          {provider.logoUrl ? (
                            <img 
                              src={provider.logoUrl} 
                              alt={provider.displayName}
                              className="w-8 h-8 object-contain"
                            />
                          ) : (
                            <span>{getProviderIcon(provider.providerName)}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">
                            {provider.displayName}
                            {provider.isDefault && (
                              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
                                Default
                              </span>
                            )}
                          </div>
                          {provider.description && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {provider.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </Button>
                  ))}
              </div>
            </>
          )}

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
