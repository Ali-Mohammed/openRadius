import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useKeycloak } from '../contexts/KeycloakContext'
import { useTheme } from '../contexts/ThemeContext'
import { Loader2 } from 'lucide-react'

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { authenticated, initialized } = useKeycloak()
  const { theme, primaryColor } = useTheme()

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

  if (!authenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
