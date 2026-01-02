import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { KeycloakProvider } from './contexts/KeycloakContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import ProfileSettings from './pages/ProfileSettings'
import Settings from './pages/Settings'
import InstantView from './pages/InstantView'
import InstantSettings from './pages/InstantSettings'
import OidcSettings from './pages/OidcSettings'
import RadiusProfiles from './pages/RadiusProfiles'
import RadiusUsers from './pages/RadiusUsers'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <KeycloakProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Routes>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/profile" element={<ProfileSettings />} />
                        <Route path="/instant/view" element={<InstantView />} />
                        <Route path="/instant/:id/settings" element={<InstantSettings />} />
                        <Route path="/integration/sas-radius" element={<Navigate to="/instant/1/settings" replace />} />
                        <Route path="/radius/profiles" element={<RadiusProfiles />} />
                        <Route path="/radius/users" element={<RadiusUsers />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/settings/oidc" element={<OidcSettings />} />
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
          <Toaster richColors position="top-right" />
        </KeycloakProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
