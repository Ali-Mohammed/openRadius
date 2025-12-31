import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Shield, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { appConfig } from '@/config/app.config'

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to OpenRadius</CardTitle>
          <CardDescription>
            Enterprise Authentication Platform
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
                      variant={provider.isDefault ? "default" : "outline"}
                      className="w-full justify-start text-left h-auto py-4"
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
                              <span className="ml-2 text-xs bg-primary/20 px-2 py-0.5 rounded">
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
