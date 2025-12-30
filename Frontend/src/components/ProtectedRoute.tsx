import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useKeycloak } from '../contexts/KeycloakContext'

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { authenticated, initialized } = useKeycloak()

  if (!initialized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <img 
          src="/src/openradius.svg" 
          alt="OpenRadius Logo" 
          className="h-32 w-32"
        />
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce"></div>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
