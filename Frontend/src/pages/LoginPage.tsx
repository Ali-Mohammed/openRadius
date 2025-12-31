import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useKeycloak } from '../contexts/KeycloakContext'
import { useTheme } from '../contexts/ThemeContext'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { keycloak, authenticated, initialized } = useKeycloak()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { theme, primaryColor } = useTheme()

  useEffect(() => {
    if (initialized && authenticated) {
      navigate('/dashboard')
    }
  }, [authenticated, initialized, navigate])

  const handleLogin = () => {
    const returnPath = new URLSearchParams(window.location.search).get('returnUrl') || '/dashboard'
    keycloak.login({
      redirectUri: window.location.origin + returnPath,
    })
  }

  if (!initialized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <img 
          src="/src/openradius.svg" 
          alt="OpenRadius Logo" 
          className="h-40 w-40 transition-all"
          style={{ 
            filter: theme === 'dark' 
              ? 'brightness(0) saturate(100%) invert(1)' 
              : `brightness(0) saturate(100%) invert(${primaryColor === 'blue' ? '37%' : primaryColor === 'green' ? '58%' : primaryColor === 'purple' ? '26%' : primaryColor === 'orange' ? '60%' : '37%'}) sepia(${primaryColor === 'blue' ? '98%' : primaryColor === 'green' ? '96%' : primaryColor === 'purple' ? '99%' : primaryColor === 'orange' ? '98%' : '98%'}) saturate(${primaryColor === 'blue' ? '1234%' : primaryColor === 'green' ? '2067%' : primaryColor === 'purple' ? '7497%' : primaryColor === 'orange' ? '1850%' : '1234%'}) hue-rotate(${primaryColor === 'blue' ? '205deg' : primaryColor === 'green' ? '86deg' : primaryColor === 'purple' ? '255deg' : primaryColor === 'orange' ? '1deg' : '205deg'}) brightness(${primaryColor === 'blue' ? '101%' : primaryColor === 'green' ? '96%' : primaryColor === 'purple' ? '99%' : primaryColor === 'orange' ? '94%' : '101%'}) contrast(${primaryColor === 'blue' ? '101%' : primaryColor === 'green' ? '106%' : primaryColor === 'purple' ? '110%' : primaryColor === 'orange' ? '107%' : '101%'})`
          }}
        />
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="/src/openradius.svg" 
              alt="OpenRadius Logo" 
              className="h-40 w-40 transition-all"
              style={{ 
                filter: theme === 'dark' 
                  ? 'brightness(0) saturate(100%) invert(1)' 
                  : `brightness(0) saturate(100%) invert(${primaryColor === 'blue' ? '37%' : primaryColor === 'green' ? '58%' : primaryColor === 'purple' ? '26%' : primaryColor === 'orange' ? '60%' : '37%'}) sepia(${primaryColor === 'blue' ? '98%' : primaryColor === 'green' ? '96%' : primaryColor === 'purple' ? '99%' : primaryColor === 'orange' ? '98%' : '98%'}) saturate(${primaryColor === 'blue' ? '1234%' : primaryColor === 'green' ? '2067%' : primaryColor === 'purple' ? '7497%' : primaryColor === 'orange' ? '1850%' : '1234%'}) hue-rotate(${primaryColor === 'blue' ? '205deg' : primaryColor === 'green' ? '86deg' : primaryColor === 'purple' ? '255deg' : primaryColor === 'orange' ? '1deg' : '205deg'}) brightness(${primaryColor === 'blue' ? '101%' : primaryColor === 'green' ? '96%' : primaryColor === 'purple' ? '99%' : primaryColor === 'orange' ? '94%' : '101%'}) contrast(${primaryColor === 'blue' ? '101%' : primaryColor === 'green' ? '106%' : primaryColor === 'purple' ? '110%' : primaryColor === 'orange' ? '107%' : '101%'})`
              }}
            />
          </div>
          <CardTitle>{t('app.welcome')}</CardTitle>
          <CardDescription>{t('auth.pleaseSignIn')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleLogin} className="w-full">
            {t('auth.signIn')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
