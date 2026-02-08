// Runtime config injected by Docker entrypoint (env-config.js sets window.__RUNTIME_CONFIG__)
const rc = (window as any).__RUNTIME_CONFIG__ || {}

export const appConfig = {
  appName: 'OpenRadius',
  version: '1.0.0',
  api: {
    baseUrl: rc.VITE_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000',
    timeout: 30000,
  },
  frontend: {
    baseUrl: rc.VITE_FRONTEND_URL || import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173',
  },
  seq: {
    url: rc.VITE_SEQ_URL || import.meta.env.VITE_SEQ_URL || 'http://localhost:5341',
  },
  keycloak: {
    url: rc.VITE_KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
    realm: rc.VITE_KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || 'openradius',
    clientId: rc.VITE_KEYCLOAK_CLIENT_ID || import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'openradius-frontend',
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
