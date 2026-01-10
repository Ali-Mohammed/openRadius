import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { KeycloakProvider } from './contexts/KeycloakContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { WorkspaceGuard } from './components/WorkspaceGuard'
import { AppLayout } from './components/AppLayout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import ProfileSettings from './pages/ProfileSettings'
import Settings from './pages/Settings'
import GeneralSettings from './pages/GeneralSettings'
import WorkspaceView from './pages/WorkspaceView'
import WorkspaceSettings from './pages/WorkspaceSettings'
import OidcSettings from './pages/OidcSettings'
import RadiusProfiles from './pages/RadiusProfiles'
import RadiusUsers from './pages/RadiusUsers'
import RadiusGroups from './pages/RadiusGroups'
import RadiusTags from './pages/RadiusTags'
import RadiusNas from './pages/RadiusNas'
import RadiusIpPools from './pages/RadiusIpPools'
import UserManagement from './pages/UserManagement'
import RolesPage from './pages/RolesPage'
import PermissionsPage from './pages/PermissionsPage'
import GroupsPage from './pages/GroupsPage'
import Connectors from './pages/Connectors'
import DebeziumSettings from './pages/DebeziumSettings'
import CdcMonitor from './pages/CdcMonitor'
import CustomWallets from './pages/CustomWallets'
import UserWallets from './pages/UserWallets'
import TopUp from './pages/TopUp'
import WalletHistory from './pages/WalletHistory'
import Transactions from './pages/Transactions'
import Balances from './pages/Balances'
import Addons from './pages/Addons'
import BillingGroups from './pages/BillingGroups'
import BillingProfiles from './pages/BillingProfiles'
import BillingProfileForm from './pages/BillingProfileForm'
import Dashboards from './pages/Dashboards'
import DashboardView from './pages/DashboardView'
import NetworkSettings from './pages/NetworkSettings'

// Redirect component that uses dynamic workspace ID
const WorkspaceSettingsRedirect = () => {
  const { currentWorkspaceId } = useWorkspace()
  return <Navigate to={`/workspace/${currentWorkspaceId || 1}/settings`} replace />
}

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <KeycloakProvider>
          <WorkspaceProvider>
            <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <WorkspaceGuard>
                      <AppLayout>
                        <Routes>
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/profile" element={<ProfileSettings />} />
                          <Route path="/workspace/view" element={<WorkspaceView />} />
                          <Route path="/workspace/:id/settings" element={<WorkspaceSettings />} />
                          <Route path="/integration/sas-radius" element={<WorkspaceSettingsRedirect />} />
                          <Route path="/workspace/:id/radius/profiles" element={<RadiusProfiles />} />
                          <Route path="/workspace/:id/radius/users" element={<RadiusUsers />} />
                          <Route path="/workspace/:id/radius/groups" element={<RadiusGroups />} />
                          <Route path="/workspace/:id/radius/tags" element={<RadiusTags />} />
                          <Route path="/workspace/:id/radius/nas" element={<RadiusNas />} />
                          <Route path="/workspace/:id/radius/ip-pools" element={<RadiusIpPools />} />
                          <Route path="/network/settings" element={<NetworkSettings />} />
                          <Route path="/workspace/:id/settings/general" element={<GeneralSettings />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/settings/oidc" element={<OidcSettings />} />
                          <Route path="/users" element={<UserManagement />} />
                          <Route path="/roles" element={<RolesPage />} />
                          <Route path="/permissions" element={<PermissionsPage />} />
                          <Route path="/groups" element={<GroupsPage />} />
                          <Route path="/connectors" element={<Connectors />} />
                          <Route path="/connectors/settings" element={<DebeziumSettings />} />
                          <Route path="/cdc-monitor" element={<CdcMonitor />} />
                          <Route path="/billing/wallets" element={<CustomWallets />} />
                          <Route path="/billing/user-wallets" element={<UserWallets />} />
                          <Route path="/billing/balances" element={<Balances />} />
                          <Route path="/billing/addons" element={<Addons />} />
                          <Route path="/billing/groups" element={<BillingGroups />} />
                          <Route path="/workspace/:id/billing/profiles" element={<BillingProfiles />} />
                          <Route path="/workspace/:id/billing/profiles/new" element={<BillingProfileForm />} />
                          <Route path="/workspace/:id/billing/profiles/edit" element={<BillingProfileForm />} />
                          <Route path="/billing/topup" element={<TopUp />} />
                          <Route path="/billing/history" element={<WalletHistory />} />
                          <Route path="/billing/transactions" element={<Transactions />} />
                          <Route path="/dashboards" element={<Dashboards />} />
                          <Route path="/dashboards/:id" element={<DashboardView />} />
                          <Route path="/dashboards/:id/edit" element={<DashboardView />} />
                          <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                      </AppLayout>
                    </WorkspaceGuard>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
          <Toaster richColors position="top-right" />
        </WorkspaceProvider>
      </KeycloakProvider>
    </ThemeProvider>
  </QueryClientProvider>
  )
}

export default App

