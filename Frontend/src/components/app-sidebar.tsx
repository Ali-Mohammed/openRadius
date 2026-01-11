import * as React from "react"
import { ChevronRight, Plug, Users, Users as UsersIcon, CircleUser, Building2, Settings, LayoutDashboard, Radio, Eye, Wrench, SlidersHorizontal, Key, DollarSign, UserCog, Shield, Lock, Tag, UsersRound, UserRound, Server, Network, CreditCard, Package, Gift, Wallet, History, Coins, FileText, UserCheck, Database, Activity, ArrowUpCircle, Receipt, Antenna, Cable, Box, Zap, Monitor, BarChart3, MapPin } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"
import { dashboardApi } from "@/api/dashboardApi"
import type { Dashboard } from "@/types/dashboard"

import { SearchForm } from "@/components/search-form"
import { WorkspaceSwitcher } from "@/components/workspace-switcher"
import { VersionSwitcher } from "@/components/version-switcher"
import { NavUser } from "@/components/nav-user"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

// This is sample data.
const DEFAULT_workspace_ID = 1 // Fallback

// Function to create nav data with dynamic workspace ID
const getNavData = (workspaceId: number) => ({
  versions: ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"],
  navMain: [
    {
      titleKey: "navigation.dashboards",
      url: "/dashboards",
      icon: LayoutDashboard,
      items: [], // Will be populated with actual dashboards
    },
    {
      titleKey: "navigation.radius",
      url: "#",
      icon: LayoutDashboard,
      items: [
        {
          titleKey: "navigation.users",
          url: `/radius/users`,
          icon: Users,
        },
        {
          titleKey: "navigation.profiles",
          url: `/radius/profiles`,
          icon: CircleUser,
        },
        {
          titleKey: "navigation.groups",
          url: `/radius/groups`,
          icon: UsersRound,
        },
        {
          titleKey: "navigation.tags",
          url: `/radius/tags`,
          icon: Tag,
        },
        {
          titleKey: "navigation.nas",
          url: `/radius/nas`,
          icon: Server,
        },
        {
          titleKey: "navigation.ipPools",
          url: `/radius/ip-pools`,
          icon: Network,
        },
      ],
    },
    {
      titleKey: "navigation.billing",
      url: "#",
      icon: CreditCard,
      items: [
        {
          titleKey: "navigation.billingProfiles",
          url: `/workspace/${workspaceId}/billing/profiles`,
          icon: FileText,
        },
        {
          titleKey: "navigation.addons",
          url: "/billing/addons",
          icon: Package,
        },
        {
          titleKey: "navigation.groups",
          url: "/billing/groups",
          icon: UsersIcon,
        },
        {
          titleKey: "navigation.cashbacks",
          url: "/billing/cashbacks",
          icon: Gift,
        },
        {
          titleKey: "navigation.customWallets",
          url: "/billing/wallets",
          icon: Wallet,
        },
        {
          titleKey: "navigation.userWallets",
          url: "/billing/user-wallets",
          icon: Users,
        },
        {
          titleKey: "navigation.topUp",
          url: "/billing/topup",
          icon: ArrowUpCircle,
        },
        {
          titleKey: "navigation.walletHistory",
          url: "/billing/history",
          icon: History,
        },
        {
          titleKey: "navigation.transactions",
          url: "/billing/transactions",
          icon: Receipt,
        },
        {
          titleKey: "navigation.balances",
          url: "/billing/balances",
          icon: Coins,
        },
        {
          titleKey: "navigation.zones",
          url: `/billing/zones`,
          icon: MapPin,
        },
        {
          titleKey: "navigation.automations",
          url: "/billing/automations",
          icon: Zap,
        },
      ],
    },
    {
      titleKey: "navigation.network",
      url: "#",
      icon: Antenna,
      items: [
        {
          titleKey: "navigation.olts",
          url: "/network/olts",
          icon: Cable,
        },
        {
          titleKey: "navigation.fdts",
          url: "/network/fdts",
          icon: Box,
        },
        {
          titleKey: "navigation.fats",
          url: "/network/fats",
          icon: Box,
        },
        {
          titleKey: "navigation.provisioning",
          url: "/network/provisioning",
          icon: Zap,
        },
        {
          titleKey: "navigation.monitoring",
          url: "/network/monitoring",
          icon: Monitor,
        },
        {
          titleKey: "navigation.networkReports",
          url: "/network/reports",
          icon: BarChart3,
        },
        {
          titleKey: "navigation.networkSettings",
          url: "/network/settings",
          icon: Settings,
        },
      ],
    },
    {
      titleKey: "navigation.connectors",
      url: "#",
      icon: Database,
      items: [
        {
          titleKey: "navigation.connectorList",
          url: "/connectors",
          icon: Database,
        },
        {
          titleKey: "navigation.cdcMonitor",
          url: "/cdc-monitor",
          icon: Activity,
        },
        {
          titleKey: "navigation.connectorSettings",
          url: "/connectors/settings",
          icon: Settings,
        },
      ],
    },
    {
      titleKey: "navigation.appSetting",
      url: "#",
      icon: SlidersHorizontal,
      items: [
        {
          titleKey: "navigation.workspace",
          url: "/workspace/view",
          icon: Eye,
        },
        {
          titleKey: "navigation.setting",
          url: "/workspace/setting",
          icon: Wrench,
        },
        {
          titleKey: "navigation.general",
          url: `/workspace/${workspaceId}/settings/general`,
          icon: DollarSign,
        },
        {
          titleKey: "navigation.oidc",
          url: "/settings/oidc",
          icon: Key,
        },
        {
          titleKey: "navigation.databaseBackup",
          url: "/settings/database-backup",
          icon: Database,
        },
        {
          titleKey: "navigation.sasRadius",
          url: "/integration/sas-radius",
          icon: Radio,
        },
      ],
    },
    {
      titleKey: "navigation.userManagement",
      url: "#",
      icon: UserCog,
      items: [
        {
          titleKey: "navigation.users",
          url: "/users",
          icon: UserCheck,
        },
        {
          titleKey: "navigation.roles",
          url: "/roles",
          icon: Shield,
        },
        {
          titleKey: "navigation.permissions",
          url: "/permissions",
          icon: Lock,
        },
        {
          titleKey: "navigation.userGroups",
          url: "/groups",
          icon: UserRound,
        },
      ],
    },
  ],
})

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { theme, primaryColor } = useTheme()
  const { currentWorkspaceId } = useWorkspace()
  const { t } = useTranslation()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [dashboards, setDashboards] = React.useState<Dashboard[]>([])

  // Load dashboards
  React.useEffect(() => {
    const loadDashboards = async () => {
      try {
        const data = await dashboardApi.getDashboards()
        setDashboards(data)
      } catch (error) {
        console.error('Error loading dashboards:', error)
      }
    }
    loadDashboards()
  }, [])

  // Get nav data with current workspace ID (fallback to 1 if not loaded yet)
  const data = React.useMemo(() => {
    const navData = getNavData(currentWorkspaceId || 1)
    // Update dashboards items with actual dashboard data
    const dashboardsIndex = navData.navMain.findIndex(item => item.titleKey === 'navigation.dashboards')
    if (dashboardsIndex !== -1 && dashboards.length > 0) {
      navData.navMain[dashboardsIndex].items = dashboards.map(dashboard => ({
        titleKey: dashboard.name, // Use dashboard name directly, not a translation key
        url: `/dashboards/${dashboard.id}`,
        icon: LayoutDashboard,
      }))
    }
    return navData
  }, [currentWorkspaceId, dashboards])

  // Filter and sort menu items based on search query
  const filteredNavMain = React.useMemo(() => {
    if (!searchQuery.trim()) {
      // Return items in original order (dashboards first)
      return [...data.navMain]
    }

    const query = searchQuery.toLowerCase()
    return data.navMain
      .map(item => {
        const parentMatch = t(item.titleKey).toLowerCase().includes(query)
        
        // Handle items without sub-items
        if (!item.items || item.items.length === 0) {
          return parentMatch ? item : null
        }
        
        const filteredItems = item.items.filter(subItem => {
          // For dashboards, use the name directly instead of translation
          const subItemName = item.titleKey === 'navigation.dashboards' 
            ? subItem.titleKey.toLowerCase() 
            : t(subItem.titleKey).toLowerCase()
          return subItemName.includes(query)
        })
        
        // Include parent if it matches or has matching children
        if (parentMatch || filteredItems.length > 0) {
          return {
            ...item,
            items: filteredItems.length > 0 ? filteredItems : item.items
          }
        }
        return null
      })
      .filter(Boolean)
  }, [searchQuery, t, data.navMain])

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <Link to="/dashboard" className="flex items-center gap-3 px-2 py-3 hover:bg-accent rounded-md transition-colors">
          <img 
            src="/src/openradius.svg" 
            alt="OpenRadius Logo" 
            className="h-10 w-10 transition-all"
            style={{ 
              filter: theme === 'dark' 
                ? 'brightness(0) saturate(100%) invert(1)' 
                : `brightness(0) saturate(100%) invert(${primaryColor === 'blue' ? '37%' : primaryColor === 'green' ? '58%' : primaryColor === 'purple' ? '26%' : primaryColor === 'orange' ? '60%' : '37%'}) sepia(${primaryColor === 'blue' ? '98%' : primaryColor === 'green' ? '96%' : primaryColor === 'purple' ? '99%' : primaryColor === 'orange' ? '98%' : '98%'}) saturate(${primaryColor === 'blue' ? '1234%' : primaryColor === 'green' ? '2067%' : primaryColor === 'purple' ? '7497%' : primaryColor === 'orange' ? '1850%' : '1234%'}) hue-rotate(${primaryColor === 'blue' ? '205deg' : primaryColor === 'green' ? '86deg' : primaryColor === 'purple' ? '255deg' : primaryColor === 'orange' ? '1deg' : '205deg'}) brightness(${primaryColor === 'blue' ? '101%' : primaryColor === 'green' ? '96%' : primaryColor === 'purple' ? '99%' : primaryColor === 'orange' ? '94%' : '101%'}) contrast(${primaryColor === 'blue' ? '101%' : primaryColor === 'green' ? '106%' : primaryColor === 'purple' ? '110%' : primaryColor === 'orange' ? '107%' : '101%'})`
            }}
          />
          <div className="flex flex-col justify-center">
            <h1 className="text-lg font-bold tracking-tight">{t('app.name')}</h1>
            <p className="text-xs text-muted-foreground">{t('app.welcome')}</p>
          </div>
        </Link>
        <WorkspaceSwitcher />
        <SearchForm searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {/* We create a collapsible SidebarGroup for each parent. */}
        {filteredNavMain.map((item) => (
          item.items ? (
            <Collapsible
              key={item.titleKey}
              title={t(item.titleKey)}
              defaultOpen
              className="group/collapsible"
            >
              <SidebarGroup>
                {item.titleKey === 'navigation.dashboards' ? (
                  <>
                    <SidebarGroupLabel className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm">
                      <div className="flex items-center w-full">
                        <item.icon className="mr-2 h-4 w-4 text-primary" />
                        <Link to={item.url} className="flex-1 cursor-pointer">
                          {t(item.titleKey)}
                        </Link>
                        <CollapsibleTrigger className="ml-auto cursor-pointer">
                          <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </CollapsibleTrigger>
                      </div>
                    </SidebarGroupLabel>
                  </>
                ) : (
                  <SidebarGroupLabel
                    asChild
                    className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm cursor-pointer"
                  >
                    <CollapsibleTrigger className="w-full cursor-pointer">
                      <item.icon className="mr-2 h-4 w-4 text-primary" />
                      {t(item.titleKey)}
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                )}
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {item.items.map((subItem) => {
                        // For dashboards, use the name directly instead of translation
                        const displayName = item.titleKey === 'navigation.dashboards'
                          ? subItem.titleKey
                          : t(subItem.titleKey)
                        return (
                          <SidebarMenuItem key={subItem.titleKey}>
                            <SidebarMenuButton asChild isActive={location.pathname === subItem.url} className="ml-4">
                              <Link to={subItem.url}>
                                <subItem.icon className="mr-2 h-4 w-4 text-primary" />
                                {displayName}
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          ) : (
            <SidebarGroup key={item.titleKey}>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <Link to={item.url}>
                      <item.icon className="mr-2 h-4 w-4 text-primary" />
                      {t(item.titleKey)}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          )
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

