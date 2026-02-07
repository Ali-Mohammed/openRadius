import { apiClient } from '../lib/api'

export interface MenuItem {
  titleKey: string
  url: string
  icon: string
  items: MenuItem[]
  requiredPermission?: string
  isDynamic?: boolean
}

export interface NavigationMenuResponse {
  menu: MenuItem[]
  permissions: string[]
  isSuperAdmin: boolean
}

export const navigationApi = {
  /**
   * Fetches the navigation menu filtered by the current user's permissions.
   * Called once on app load and cached in state.
   */
  getMenu: async (): Promise<NavigationMenuResponse> => {
    const response = await apiClient.get<NavigationMenuResponse>('/api/navigation/menu')
    return response.data
  },
}
