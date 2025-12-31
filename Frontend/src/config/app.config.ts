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
    defaultColor: 'blue' as string,
    availableColors: [
      { name: 'Blue', value: 'blue', class: 'hsl(221.2 83.2% 53.3%)' },
      { name: 'Green', value: 'green', class: 'hsl(142.1 76.2% 36.3%)' },
      { name: 'Purple', value: 'purple', class: 'hsl(262.1 83.3% 57.8%)' },
      { name: 'Red', value: 'red', class: 'hsl(0 72.2% 50.6%)' },
      { name: 'Orange', value: 'orange', class: 'hsl(24.6 95% 53.1%)' },
    ],
  },
  i18n: {
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'ar'],
  },
}

export type AppConfig = typeof appConfig
