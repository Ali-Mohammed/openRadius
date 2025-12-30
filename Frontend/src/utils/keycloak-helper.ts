import Keycloak from 'keycloak-js'

export const getUserRoles = (keycloak: Keycloak): string[] => {
  if (!keycloak.tokenParsed) return []
  
  const roles: string[] = []
  
  // Get realm roles
  if (keycloak.tokenParsed.realm_access?.roles) {
    roles.push(...keycloak.tokenParsed.realm_access.roles)
  }
  
  return roles
}

export const getUserGroups = (keycloak: Keycloak): string[] => {
  if (!keycloak.tokenParsed) return []
  
  // Groups are typically in a 'groups' claim
  return (keycloak.tokenParsed as any).groups || []
}

export const hasRole = (keycloak: Keycloak, role: string): boolean => {
  return keycloak.hasRealmRole(role) || keycloak.hasResourceRole(role)
}

export const hasAnyRole = (keycloak: Keycloak, roles: string[]): boolean => {
  return roles.some(role => hasRole(keycloak, role))
}

export const hasAllRoles = (keycloak: Keycloak, roles: string[]): boolean => {
  return roles.every(role => hasRole(keycloak, role))
}
