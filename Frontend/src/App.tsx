import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { KeycloakProvider } from './contexts/KeycloakContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { WorkspaceGuard } from './components/WorkspaceGuard'
import { AppLayout } from './components/AppLayout'
// Auth
import LoginPage from './pages/auth/LoginPage'
// Dashboards
import Dashboard from './pages/dashboards/Dashboard'
import Dashboards from './pages/dashboards/Dashboards'
import DashboardView from './pages/dashboards/DashboardView'
// Radius
import RadiusProfiles from './pages/radius/RadiusProfiles'
import RadiusUsers from './pages/radius/RadiusUsers'
import RadiusGroups from './pages/radius/RadiusGroups'
import RadiusTags from './pages/radius/RadiusTags'
import RadiusNas from './pages/radius/RadiusNas'
import RadiusIpPools from './pages/radius/RadiusIpPools'
import RadiusIpReservations from './pages/radius/RadiusIpReservations'
import RadiusCustomAttributes from './pages/radius/RadiusCustomAttributes'
import Zones from './pages/radius/Zones'
import RadiusActivations from './pages/radius/RadiusActivations'
// Integrations
import Integrations from './pages/integrations/Integrations'
// Billing
import BillingProfiles from './pages/billing/BillingProfiles'
import BillingProfileForm from './pages/billing/BillingProfileForm'
import BillingActivations from './pages/billing/BillingActivations'
import Addons from './pages/billing/Addons'
import BillingGroups from './pages/billing/BillingGroups'
import CashbackProfiles from './pages/billing/CashbackProfiles'
import CashbackGroups from './pages/billing/CashbackGroups'
import SubAgentCashbacks from './pages/billing/SubAgentCashbacks'
import CustomWallets from './pages/billing/CustomWallets'
import UserWallets from './pages/billing/UserWallets'
import TopUp from './pages/billing/TopUp'
import WalletHistory from './pages/billing/WalletHistory'
import Transactions from './pages/billing/Transactions'
import Balances from './pages/billing/Balances'
import Automations from './pages/billing/Automations'
// Network
import Olts from './pages/network/Olts'
import Fdts from './pages/network/Fdts'
import Fats from './pages/network/Fats'
import NetworkSettings from './pages/network/NetworkSettings'
// Connectors
import Connectors from './pages/connectors/Connectors'
import CdcMonitor from './pages/connectors/CdcMonitor'
import DebeziumSettings from './pages/connectors/DebeziumSettings'
// Microservices
import RadiusSyncService from './pages/microservices/RadiusSyncService'
import RadiusSyncServiceDetail from './pages/microservices/RadiusSyncServiceDetail'
import MicroserviceApprovals from './pages/microservices/MicroserviceApprovals'
// Settings
import WorkspaceView from './pages/settings/WorkspaceView'
import GeneralSettings from './pages/settings/GeneralSettings'
import PaymentInformation from './pages/settings/PaymentInformation'
import OidcSettings from './pages/settings/OidcSettings'
import DatabaseBackup from './pages/settings/DatabaseBackup'
import WorkspaceSettings from './pages/settings/WorkspaceSettings'
// User Management
import UserManagement from './pages/user-management/UserManagement'
import RolesPage from './pages/user-management/RolesPage'
import PermissionsPage from './pages/user-management/PermissionsPage'
// Other
import ProfileSettings from './pages/ProfileSettings'
import Settings from './pages/Settings'
import GroupsPage from './pages/GroupsPage'
import WorkflowDesigner from './pages/WorkflowDesigner'
import FreeRadiusLogsViewer from './pages/FreeRadiusLogsViewer'
// Payment
import PaymentResultPage from './pages/payments/PaymentResultPage'

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
              {/* Payment callback routes - must be accessible without authentication */}
              <Route path="/payment/success" element={<PaymentResultPage />} />
              <Route path="/payment/failed" element={<PaymentResultPage />} />
              <Route path="/payment/cancelled" element={<PaymentResultPage />} />
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
                          <Route path="/integrations" element={<Integrations />} />
                          <Route path="/integrations/sas-radius" element={<WorkspaceSettings />} />
                          <Route path="/radius/profiles" element={<RadiusProfiles />} />
                          <Route path="/radius/users" element={<RadiusUsers />} />
                          <Route path="/radius/groups" element={<RadiusGroups />} />
                          <Route path="/radius/tags" element={<RadiusTags />} />
                          <Route path="/radius/nas" element={<RadiusNas />} />
                          <Route path="/radius/ip-pools" element={<RadiusIpPools />} />
                          <Route path="/radius/ip-reservations" element={<RadiusIpReservations />} />
                          <Route path="/radius/custom-attributes" element={<RadiusCustomAttributes />} />
                          <Route path="/radius/zones" element={<Zones />} />
                          <Route path="/radius/logs" element={<FreeRadiusLogsViewer />} />
                          <Route path="/radius/activations" element={<RadiusActivations />} />
                          <Route path="/network/settings" element={<NetworkSettings />} />
                          <Route path="/network/olts" element={<Olts />} />
                          <Route path="/network/fdts" element={<Fdts />} />
                          <Route path="/network/fats" element={<Fats />} />
                          <Route path="/settings/general" element={<GeneralSettings />} />
                          <Route path="/settings/payment-history" element={<PaymentInformation />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/settings/oidc" element={<OidcSettings />} />
                          <Route path="/settings/database-backup" element={<DatabaseBackup />} />
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
                          <Route path="/billing/automations" element={<Automations />} />
                          <Route path="/billing/automations/:automationId/designer" element={<WorkflowDesigner />} />
                          <Route path="/billing/groups" element={<BillingGroups />} />
                          <Route path="/billing/cashback-groups" element={<CashbackGroups />} />
                          <Route path="/billing/cashbacks" element={<CashbackProfiles />} />
                          <Route path="/billing/sub-agent-cashbacks" element={<SubAgentCashbacks />} />
                          <Route path="/billing/profiles" element={<BillingProfiles />} />
                          <Route path="/billing/profiles/new" element={<BillingProfileForm />} />
                          <Route path="/billing/profiles/edit" element={<BillingProfileForm />} />
                          <Route path="/billing/activations" element={<BillingActivations />} />
                          <Route path="/billing/topup" element={<TopUp />} />
                          <Route path="/billing/history" element={<WalletHistory />} />
                          <Route path="/billing/transactions" element={<Transactions />} />
                          <Route path="/dashboards" element={<Dashboards />} />
                          <Route path="/dashboards/:id" element={<DashboardView />} />
                          <Route path="/dashboards/:id/edit" element={<DashboardView />} />
                          <Route path="/microservices/radius-sync" element={<RadiusSyncService />} />
                          <Route path="/microservices/radius-sync/:serviceName" element={<RadiusSyncServiceDetail />} />
                          <Route path="/microservices/approvals" element={<MicroserviceApprovals />} />
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

