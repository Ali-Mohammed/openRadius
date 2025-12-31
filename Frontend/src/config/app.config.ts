export const appConfig = {
  appName: 'OpenRadius',
  version: '1.0.0',
  api: {
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    timeout: 30000,
  },
  frontend: {
    baseUrl: import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173',
  },
  keycloak: {
    url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
    realm: import.meta.env.VITE_KEYCLOAK_REALM || 'openradius',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'openradius-frontend',
  },
  theme: {
    defaultMode: 'light' as 'light' | 'dark',
    defaultColor: 'purple' as string,
    availableColors: [
      { name: 'Blue', value: 'blue', class: 'oklch(0.583 0.187 262.881)' },
      { name: 'Green', value: 'green', class: 'oklch(0.552 0.166 152.482)' },
      { name: 'Purple', value: 'purple', class: 'oklch(0.631 0.242 297.696)' },
      { name: 'Red', value: 'red', class: 'oklch(0.637 0.237 27.325)' },
      { name: 'Orange', value: 'orange', class: 'oklch(0.705 0.186 56.049)' },
    ],
  },
  i18n: {
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'ar'],
  },
}

export type AppConfig = typeof appConfig
