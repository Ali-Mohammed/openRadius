import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import keycloak from '../keycloak'

/**
 * OIDC Authentication Context
 * Manages authentication state using OpenID Connect (OIDC) Authorization Code Flow
 * Supports multiple OIDC providers (Keycloak, Azure AD, Google, etc.)
 * Provider selection is managed from the login page and admin panel
 */
interface KeycloakContextType {
  keycloak: typeof keycloak
  authenticated: boolean
  initialized: boolean
  currentProvider: string
}

const KeycloakContext = createContext<KeycloakContextType | undefined>(undefined)

let isInitializing = false
let hasInitialized = false

export const KeycloakProvider = ({ children }: { children: ReactNode }) => {
  const [authenticated, setAuthenticated] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [currentProvider, setCurrentProvider] = useState('keycloak')

  useEffect(() => {
    // Get selected provider from sessionStorage
    const storedProvider = sessionStorage.getItem('selectedOidcProvider')
    if (storedProvider) {
      try {
        const config = JSON.parse(storedProvider)
        setCurrentProvider(config.providerName || 'keycloak')
        console.log('Current OIDC provider:', config.providerName)
      } catch (error) {
        console.error('Failed to parse provider config:', error)
      }
    }

    if (hasInitialized) {
      setAuthenticated(keycloak.authenticated || false)
      setInitialized(true)
      return
    }

    if (isInitializing) {
      return
    }

    isInitializing = true

    // Check if provider parameter exists in URL (user clicked login button)
    const urlParams = new URLSearchParams(window.location.search)
    const providerParam = urlParams.get('provider')
    const shouldLogin = providerParam !== null

    /**
     * Initialize OIDC authentication with Authorization Code Flow
     * - Uses 'login-required' to prompt authentication when provider is selected
     * - Uses 'check-sso' to check for existing session otherwise
     * - Automatically refreshes tokens to maintain session
     * - Works with any OIDC-compliant provider (Keycloak, Azure AD, Google, etc.)
     * - Disabled silent SSO to avoid CSP frame-ancestors issues
     */
    keycloak
      .init({
        onLoad: shouldLogin ? 'login-required' : 'check-sso',
        checkLoginIframe: false,
        silentCheckSsoRedirectUri: undefined, // Disable silent SSO to avoid CSP issues
        enableLogging: true,
        flow: 'standard', // OIDC Authorization Code Flow
        pkceMethod: 'S256', // Use PKCE for enhanced security
        responseMode: 'fragment',
      })
      .then((auth) => {
        setAuthenticated(auth)
        setInitialized(true)
        hasInitialized = true
        isInitializing = false

        console.log('OIDC Authentication initialized:', auth ? 'Authenticated' : 'Not authenticated')
        
        if (auth && storedProvider) {
          try {
            const config = JSON.parse(storedProvider)
            console.log(`✓ Authenticated via ${config.providerName}`)
          } catch (error) {
            // Ignore parse error
          }
        }

        // Automatic token refresh for authenticated users
        if (auth) {
          // Refresh token every 60 seconds if it expires in 70 seconds
          setInterval(() => {
            keycloak.updateToken(70)
              .then((refreshed) => {
                if (refreshed) {
                  console.log('OIDC Token refreshed')
                }
              })
              .catch(() => {
                console.error('Failed to refresh OIDC token')
                // Token refresh failed, user needs to re-authenticate
                keycloak.logout()
              })
          }, 60000)
        }
      })
      .catch((error) => {
        console.error('OIDC initialization failed', error)
        setInitialized(true)
        hasInitialized = true
        isInitializing = false
      })
  }, [])

  return (
    <KeycloakContext.Provider value={{ keycloak, authenticated, initialized, currentProvider }}>
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
