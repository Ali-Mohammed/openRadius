import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { KeycloakProvider } from './contexts/KeycloakContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext'
import { PermissionProvider } from './contexts/PermissionContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PermissionRoute } from './components/PermissionRoute'
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
import RadiusUserDetail from './pages/radius/RadiusUserDetail'
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
import ActivationLogs from './pages/integrations/ActivationLogs'
import SessionsSync from './pages/integrations/SessionsSync'
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
import SystemUpdatePage from './pages/settings/SystemUpdatePage'
import ServerMonitoring from './pages/settings/ServerMonitoring'
import AuditLogs from './pages/settings/AuditLogs'
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
                    <PermissionProvider>
                    <WorkspaceGuard>
                      <AppLayout>
                        <Routes>
                          <Route path="/dashboard" element={<PermissionRoute permission="dashboard.view"><Dashboard /></PermissionRoute>} />
                          <Route path="/profile" element={<ProfileSettings />} />
                          <Route path="/workspace/view" element={<PermissionRoute permission="workspace.view"><WorkspaceView /></PermissionRoute>} />
                          <Route path="/workspace/server-monitoring" element={<PermissionRoute permission="server-monitoring.view"><ServerMonitoring /></PermissionRoute>} />
                          <Route path="/integrations" element={<PermissionRoute permission="settings.integrations.view"><Integrations /></PermissionRoute>} />
                          <Route path="/integrations/sas-radius" element={<PermissionRoute permission="settings.integrations.view"><WorkspaceSettings /></PermissionRoute>} />
                          <Route path="/integrations/activation-logs/:integrationId" element={<PermissionRoute permission="settings.integrations.view"><ActivationLogs /></PermissionRoute>} />
                          <Route path="/integrations/sessions-sync/:integrationId" element={<PermissionRoute permission="settings.integrations.view"><SessionsSync /></PermissionRoute>} />
                          <Route path="/radius/profiles" element={<PermissionRoute permission="radius.profiles.view"><RadiusProfiles /></PermissionRoute>} />
                          <Route path="/radius/users" element={<PermissionRoute permission="radius.users.view"><RadiusUsers /></PermissionRoute>} />
                          <Route path="/radius/users/:id" element={<PermissionRoute permission="radius.users.view"><RadiusUserDetail /></PermissionRoute>} />
                          <Route path="/radius/users/:id/:tab" element={<PermissionRoute permission="radius.users.view"><RadiusUserDetail /></PermissionRoute>} />
                          <Route path="/radius/groups" element={<PermissionRoute permission="radius.groups.view"><RadiusGroups /></PermissionRoute>} />
                          <Route path="/radius/tags" element={<PermissionRoute permission="radius.tags.view"><RadiusTags /></PermissionRoute>} />
                          <Route path="/radius/nas" element={<PermissionRoute permission="radius.nas.view"><RadiusNas /></PermissionRoute>} />
                          <Route path="/radius/ip-pools" element={<PermissionRoute permission="radius.ip-pools.view"><RadiusIpPools /></PermissionRoute>} />
                          <Route path="/radius/ip-reservations" element={<PermissionRoute permission="radius.ip-reservations.view"><RadiusIpReservations /></PermissionRoute>} />
                          <Route path="/radius/custom-attributes" element={<PermissionRoute permission="radius.custom-attributes.view"><RadiusCustomAttributes /></PermissionRoute>} />
                          <Route path="/radius/zones" element={<PermissionRoute permission="radius.zones.view"><Zones /></PermissionRoute>} />
                          <Route path="/radius/logs" element={<PermissionRoute permission="freeradius.logs.view"><FreeRadiusLogsViewer /></PermissionRoute>} />
                          <Route path="/radius/activations" element={<PermissionRoute permission="radius.activations.view"><RadiusActivations /></PermissionRoute>} />
                          <Route path="/network/settings" element={<PermissionRoute permission="network.settings.view"><NetworkSettings /></PermissionRoute>} />
                          <Route path="/network/olts" element={<PermissionRoute permission="network.olts.view"><Olts /></PermissionRoute>} />
                          <Route path="/network/fdts" element={<PermissionRoute permission="network.fdts.view"><Fdts /></PermissionRoute>} />
                          <Route path="/network/fats" element={<PermissionRoute permission="network.fats.view"><Fats /></PermissionRoute>} />
                          <Route path="/settings/general" element={<PermissionRoute permission="settings.general.view"><GeneralSettings /></PermissionRoute>} />
                          <Route path="/settings/payment-history" element={<PermissionRoute permission="settings.payment-history.view"><PaymentInformation /></PermissionRoute>} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/settings/oidc" element={<PermissionRoute permission="settings.oidc.view"><OidcSettings /></PermissionRoute>} />
                          <Route path="/settings/database-backup" element={<PermissionRoute permission="settings.database-backup.view"><DatabaseBackup /></PermissionRoute>} />
                          <Route path="/settings/system-update" element={<PermissionRoute permission="settings.system-update.view"><SystemUpdatePage /></PermissionRoute>} />
                          <Route path="/audit-logs" element={<PermissionRoute permission="audit.view"><AuditLogs /></PermissionRoute>} />
                          <Route path="/users" element={<PermissionRoute permission="users.view"><UserManagement /></PermissionRoute>} />
                          <Route path="/roles" element={<PermissionRoute permission="roles.view"><RolesPage /></PermissionRoute>} />
                          <Route path="/permissions" element={<PermissionRoute permission="permissions.view"><PermissionsPage /></PermissionRoute>} />
                          <Route path="/groups" element={<PermissionRoute permission="groups.view"><GroupsPage /></PermissionRoute>} />
                          <Route path="/connectors" element={<PermissionRoute permission="connectors.list.view"><Connectors /></PermissionRoute>} />
                          <Route path="/connectors/settings" element={<PermissionRoute permission="connectors.settings.view"><DebeziumSettings /></PermissionRoute>} />
                          <Route path="/cdc-monitor" element={<PermissionRoute permission="connectors.cdc-monitor.view"><CdcMonitor /></PermissionRoute>} />
                          <Route path="/billing/wallets" element={<PermissionRoute permission="billing.wallets.view"><CustomWallets /></PermissionRoute>} />
                          <Route path="/billing/user-wallets" element={<PermissionRoute permission="billing.user-wallets.view"><UserWallets /></PermissionRoute>} />
                          <Route path="/billing/balances" element={<PermissionRoute permission="billing.balances.view"><Balances /></PermissionRoute>} />
                          <Route path="/billing/addons" element={<PermissionRoute permission="billing.addons.view"><Addons /></PermissionRoute>} />
                          <Route path="/billing/automations" element={<PermissionRoute permission="billing.automations.view"><Automations /></PermissionRoute>} />
                          <Route path="/billing/automations/:automationId/designer" element={<PermissionRoute permission="billing.automations.update"><WorkflowDesigner /></PermissionRoute>} />
                          <Route path="/billing/groups" element={<PermissionRoute permission="billing.groups.view"><BillingGroups /></PermissionRoute>} />
                          <Route path="/billing/cashback-groups" element={<PermissionRoute permission="billing.cashback-groups.view"><CashbackGroups /></PermissionRoute>} />
                          <Route path="/billing/cashbacks" element={<PermissionRoute permission="billing.cashbacks.view"><CashbackProfiles /></PermissionRoute>} />
                          <Route path="/billing/sub-agent-cashbacks" element={<PermissionRoute permission="billing.sub-agent-cashbacks.view"><SubAgentCashbacks /></PermissionRoute>} />
                          <Route path="/billing/profiles" element={<PermissionRoute permission="billing.profiles.view"><BillingProfiles /></PermissionRoute>} />
                          <Route path="/billing/profiles/new" element={<PermissionRoute permission="billing.profiles.create"><BillingProfileForm /></PermissionRoute>} />
                          <Route path="/billing/profiles/edit" element={<PermissionRoute permission="billing.profiles.update"><BillingProfileForm /></PermissionRoute>} />
                          <Route path="/billing/activations" element={<PermissionRoute permission="billing.activations.view"><BillingActivations /></PermissionRoute>} />
                          <Route path="/billing/topup" element={<PermissionRoute permission="billing.topup.create"><TopUp /></PermissionRoute>} />
                          <Route path="/billing/history" element={<PermissionRoute permission="billing.history.view"><WalletHistory /></PermissionRoute>} />
                          <Route path="/billing/transactions" element={<PermissionRoute permission="billing.transactions.view"><Transactions /></PermissionRoute>} />
                          <Route path="/dashboards" element={<PermissionRoute permission="dashboard.view"><Dashboards /></PermissionRoute>} />
                          <Route path="/dashboards/:id" element={<PermissionRoute permission="dashboard.view"><DashboardView /></PermissionRoute>} />
                          <Route path="/dashboards/:id/edit" element={<PermissionRoute permission="dashboard.update"><DashboardView /></PermissionRoute>} />
                          <Route path="/microservices/radius-sync" element={<PermissionRoute permission="microservices.radius-sync.view"><RadiusSyncService /></PermissionRoute>} />
                          <Route path="/microservices/radius-sync/:serviceName" element={<PermissionRoute permission="microservices.radius-sync.view"><RadiusSyncServiceDetail /></PermissionRoute>} />
                          <Route path="/microservices/approvals" element={<PermissionRoute permission="microservices.radius-sync.manage"><MicroserviceApprovals /></PermissionRoute>} />
                          <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                      </AppLayout>
                    </WorkspaceGuard>
                    </PermissionProvider>
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

