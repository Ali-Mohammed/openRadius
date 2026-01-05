import * as React from "react"
import { ChevronRight, Plug, Users, CircleUser, Building2, Settings, LayoutDashboard, Radio, Eye, Wrench, SlidersHorizontal, Key, DollarSign, UserCog, Shield, Lock, Tag, UsersRound, UserRound, Server, Network, CreditCard, Package, Gift, Wallet, History, Coins, FileText, UserCheck, Database } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"

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
      titleKey: "navigation.integration",
      url: "#",
      icon: Plug,
      items: [
        {
          titleKey: "navigation.sasRadius",
          url: "/integration/sas-radius",
          icon: Radio,
        },
      ],
    },
    {
      titleKey: "navigation.radius",
      url: "#",
      icon: LayoutDashboard,
      items: [
        {
          titleKey: "navigation.users",
          url: `/workspace/${workspaceId}/radius/users`,
          icon: Users,
        },
        {
          titleKey: "navigation.profiles",
          url: `/workspace/${workspaceId}/radius/profiles`,
          icon: CircleUser,
        },
        {
          titleKey: "navigation.groups",
          url: `/workspace/${workspaceId}/radius/groups`,
          icon: UsersRound,
        },
        {
          titleKey: "navigation.tags",
          url: `/workspace/${workspaceId}/radius/tags`,
          icon: Tag,
        },
        {
          titleKey: "navigation.nas",
          url: `/workspace/${workspaceId}/radius/nas`,
          icon: Server,
        },
        {
          titleKey: "navigation.ipPools",
          url: `/workspace/${workspaceId}/radius/ip-pools`,
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
          url: `/workspace/${workspaceId}/billing/addons`,
          icon: Package,
        },
        {
          titleKey: "navigation.cashbacks",
          url: `/workspace/${workspaceId}/billing/cashbacks`,
          icon: Gift,
        },
        {
          titleKey: "navigation.wallets",
          url: `/workspace/${workspaceId}/billing/wallets`,
          icon: Wallet,
        },
        {
          titleKey: "navigation.walletsHistory",
          url: `/workspace/${workspaceId}/billing/wallets-history`,
          icon: History,
        },
        {
          titleKey: "navigation.balances",
          url: `/workspace/${workspaceId}/billing/balances`,
          icon: Coins,
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
          titleKey: "navigation.connectorSettings",
          url: "/connectors/settings",
          icon: Settings,
        },
      ],
    },
    {
      titleKey: "navigation.workspace",
      url: "#",
      icon: Building2,
      items: [
        {
          titleKey: "navigation.view",
          url: "/workspace/view",
          icon: Eye,
        },
        {
          titleKey: "navigation.setting",
          url: "/workspace/setting",
          icon: Wrench,
        },
      ],
    },
    {
      titleKey: "navigation.appSetting",
      url: "#",
      icon: SlidersHorizontal,
      items: [
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

  // Get nav data with current workspace ID (fallback to 1 if not loaded yet)
  const data = React.useMemo(() => getNavData(currentWorkspaceId || 1), [currentWorkspaceId])

  // Filter and sort menu items based on search query
  const filteredNavMain = React.useMemo(() => {
    if (!searchQuery.trim()) {
      // Sort alphabetically by translated title when no search
      return [...data.navMain].sort((a, b) => 
        t(a.titleKey).localeCompare(t(b.titleKey))
      )
    }

    const query = searchQuery.toLowerCase()
    return data.navMain
      .map(item => {
        const parentMatch = t(item.titleKey).toLowerCase().includes(query)
        const filteredItems = item.items.filter(subItem =>
          t(subItem.titleKey).toLowerCase().includes(query)
        )
        
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
      .sort((a, b) => t(a!.titleKey).localeCompare(t(b!.titleKey)))
  }, [searchQuery, t])

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
          <Collapsible
            key={item.titleKey}
            title={t(item.titleKey)}
            defaultOpen
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel
                asChild
                className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
              >
                <CollapsibleTrigger>
                  <item.icon className="mr-2 h-4 w-4 text-primary" />
                  {t(item.titleKey)}{" "}
                  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {item.items.map((subItem) => (
                      <SidebarMenuItem key={subItem.titleKey}>
                        <SidebarMenuButton asChild isActive={location.pathname === subItem.url} className="ml-4">
                          <Link to={subItem.url}>
                            <subItem.icon className="mr-2 h-4 w-4 text-primary" />
                            {t(subItem.titleKey)}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

