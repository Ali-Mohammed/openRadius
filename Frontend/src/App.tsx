import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { KeycloakProvider } from './contexts/KeycloakContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import ProfileSettings from './pages/ProfileSettings'

function App() {
  return (
    <ThemeProvider>
      <KeycloakProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/profile" element={<ProfileSettings />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </KeycloakProvider>
    </ThemeProvider>
  )
}

export default App
