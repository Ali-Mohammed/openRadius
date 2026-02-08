import Keycloak from 'keycloak-js'
import { appConfig } from '@/config/app.config'

/**
 * OIDC Authentication Configuration
 * Supports multiple OIDC providers configured from the admin panel
 * Provider selection is stored in sessionStorage from the login page
 */

interface OidcProviderConfig {
  providerName: string
  authority: string
  clientId: string
  realm?: string
}

/**
 * Get selected provider from sessionStorage or use default Keycloak
 */
function getProviderConfig(): OidcProviderConfig {
  const storedProvider = sessionStorage.getItem('selectedOidcProvider')
  
  if (storedProvider) {
    try {
      const config = JSON.parse(storedProvider)
      console.log('Using OIDC provider from session:', config.providerName)
      return config
    } catch (error) {
      console.error('Failed to parse stored provider config:', error)
    }
  }
  
  // Default to environment variables (Keycloak)
  return {
    providerName: 'keycloak',
    authority: appConfig.keycloak.url,
    clientId: appConfig.keycloak.clientId,
    realm: appConfig.keycloak.realm
  }
}

/**
 * Extract realm from authority URL for Keycloak
 * Example: http://localhost:8080/realms/openradius -> openradius
 */
function extractRealm(authority: string): string {
  const match = authority.match(/\/realms\/([^/]+)/)
  return match ? match[1] : 'openradius'
}

/**
 * Create Keycloak instance based on selected provider
 */
function createKeycloakInstance(): Keycloak {
  const config = getProviderConfig()
  
  // Extract base URL and realm from authority
  const realm = config.realm || extractRealm(config.authority)
  const url = config.authority.split('/realms/')[0] || config.authority
  
  console.log('Initializing OIDC with:', { url, realm, clientId: config.clientId })
  
  return new Keycloak({
    url,
    realm,
    clientId: config.clientId,
  })
}

const keycloak = createKeycloakInstance()

export default keycloak
