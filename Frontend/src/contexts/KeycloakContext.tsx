import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import keycloak from '../keycloak'

interface KeycloakContextType {
  keycloak: typeof keycloak
  authenticated: boolean
  initialized: boolean
}

const KeycloakContext = createContext<KeycloakContextType | undefined>(undefined)

let isInitializing = false
let hasInitialized = false

export const KeycloakProvider = ({ children }: { children: ReactNode }) => {
  const [authenticated, setAuthenticated] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (hasInitialized) {
      setAuthenticated(keycloak.authenticated || false)
      setInitialized(true)
      return
    }

    if (isInitializing) {
      return
    }

    isInitializing = true

    keycloak
      .init({
        onLoad: 'check-sso',
        checkLoginIframe: false,
        silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
      })
      .then((auth) => {
        setAuthenticated(auth)
        setInitialized(true)
        hasInitialized = true
        isInitializing = false

        // Token refresh
        if (auth) {
          setInterval(() => {
            keycloak.updateToken(70).catch(() => {
              console.error('Failed to refresh token')
            })
          }, 60000)
        }
      })
      .catch((error) => {
        console.error('Keycloak initialization failed', error)
        setInitialized(true)
        hasInitialized = true
        isInitializing = false
      })
  }, [])

  return (
    <KeycloakContext.Provider value={{ keycloak, authenticated, initialized }}>
      {children}
    </KeycloakContext.Provider>
  )
}

export const useKeycloak = () => {
  const context = useContext(KeycloakContext)
  if (!context) {
    throw new Error('useKeycloak must be used within KeycloakProvider')
  }
  return context
}
