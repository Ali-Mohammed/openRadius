import * as React from "react"
import { ChevronRight, Plug, Users, CircleUser, Building2, Settings, LayoutDashboard, Radio, Eye, Wrench, SlidersHorizontal, Key, DollarSign, UserCog, Shield, Lock, Tag, UsersRound, UserRound, Server, Network, CreditCard, Package, Gift, Wallet, History, Coins, FileText, UserCheck, Database, Activity, ArrowUpCircle, Receipt, Antenna, Cable, Box, Zap, Monitor, BarChart3, MapPin, Layers, WalletCards, TrendingUp, PiggyBank, Globe, FileStack, HardDrive, Cog, SquareStack, RefreshCcw, Loader2, type LucideIcon } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"
import { dashboardApi } from "@/api/dashboardApi"
import { navigationApi, type MenuItem } from "@/api/navigationApi"
import type { Dashboard } from "@/types/dashboard"
import logoSvg from '@/openradius.svg'

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

/**
 * Map of icon name strings (from backend) → Lucide React icon components.
 * The backend returns icon names as strings; this map resolves them to components.
 */
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  CircleUser,
  Building2,
  Settings,
  Radio,
  Eye,
  Wrench,
  SlidersHorizontal,
  Key,
  DollarSign,
  UserCog,
  Shield,
  Lock,
  Tag,
  UsersRound,
  UserRound,
  Server,
  Network,
  CreditCard,
  Package,
  Gift,
  Wallet,
  History,
  Coins,
  FileText,
  UserCheck,
  Database,
  Activity,
  ArrowUpCircle,
  Receipt,
  Antenna,
  Cable,
  Box,
  Zap,
  Monitor,
  BarChart3,
  MapPin,
  Layers,
  WalletCards,
  TrendingUp,
  PiggyBank,
  Globe,
  FileStack,
  HardDrive,
  Cog,
  SquareStack,
  RefreshCcw,
  Plug,
}

/** Resolves an icon name string to a Lucide component. Falls back to Settings. */
const resolveIcon = (iconName: string): LucideIcon => {
  return iconMap[iconName] ?? Settings
}

/** Converts backend MenuItem DTOs into the shape used by the sidebar renderer */
interface NavItem {
  titleKey: string
  url: string
  icon: LucideIcon
  items: NavItem[]
  isDynamic?: boolean
}

const toNavItems = (items: MenuItem[]): NavItem[] =>
  items.map((item) => ({
    titleKey: item.titleKey,
    url: item.url,
    icon: resolveIcon(item.icon),
    isDynamic: item.isDynamic,
    items: item.items ? toNavItems(item.items) : [],
  }))

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { theme, primaryColor } = useTheme()
  const { currentWorkspaceId } = useWorkspace()
  const { t } = useTranslation()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [dashboards, setDashboards] = React.useState<Dashboard[]>([])
  const [navItems, setNavItems] = React.useState<NavItem[]>([])
  const [menuLoading, setMenuLoading] = React.useState(true)

  // Load navigation menu from backend (filtered by user permissions)
  const loadNavigation = React.useCallback(async () => {
    try {
      setMenuLoading(true)
      const response = await navigationApi.getMenu()
      const items = toNavItems(response.menu)
      setNavItems(items)
    } catch (error) {
      console.error('Error loading navigation menu:', error)
      setNavItems([])
    } finally {
      setMenuLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadNavigation()
  }, [loadNavigation])

  // Listen for permission changes so sidebar auto-refreshes
  React.useEffect(() => {
    const handler = () => loadNavigation()
    window.addEventListener('permissions-changed', handler)
    return () => window.removeEventListener('permissions-changed', handler)
  }, [loadNavigation])

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

  // Merge dashboards into the dynamic dashboard section
  const navMain = React.useMemo(() => {
    if (navItems.length === 0) return []
    
    return navItems.map(item => {
      // For the dashboards section (isDynamic), populate children with actual dashboards
      if (item.isDynamic && item.titleKey === 'navigation.dashboards' && dashboards.length > 0) {
        return {
          ...item,
          items: dashboards.map(dashboard => ({
            titleKey: dashboard.name, // Use dashboard name directly, not a translation key
            url: `/dashboards/${dashboard.id}`,
            icon: LayoutDashboard,
            items: [],
          })),
        }
      }
      return item
    })
  }, [navItems, dashboards])

  // Filter and sort menu items based on search query
  const filteredNavMain = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return [...navMain]
    }

    const query = searchQuery.toLowerCase()
    return navMain
      .map(item => {
        const parentMatch = t(item.titleKey).toLowerCase().includes(query)
        
        if (!item.items || item.items.length === 0) {
          return parentMatch ? item : null
        }
        
        const filteredItems = item.items.filter(subItem => {
          const subItemName = item.titleKey === 'navigation.dashboards' 
            ? subItem.titleKey.toLowerCase() 
            : t(subItem.titleKey).toLowerCase()
          return subItemName.includes(query)
        })
        
        if (parentMatch || filteredItems.length > 0) {
          return {
            ...item,
            items: filteredItems.length > 0 ? filteredItems : item.items
          }
        }
        return null
      })
      .filter(Boolean) as NavItem[]
  }, [searchQuery, t, navMain])

  return (
    <Sidebar {...props} className="overflow-x-hidden">
      <SidebarHeader>
        <Link to="/dashboard" className="flex items-center gap-3 px-2 py-3 hover:bg-accent rounded-md transition-colors">
          <img 
            src={logoSvg} 
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
        {/* Loading state while fetching menu from backend */}
        {menuLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredNavMain.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {searchQuery ? t('navigation.noResults', 'No results found') : t('navigation.noAccess', 'No menu items available')}
          </div>
        ) : (
        /* We create a collapsible SidebarGroup for each parent. */
        filteredNavMain.map((item) => (
          item.items && item.items.length > 0 ? (
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
                                <subItem.icon className="mr-2 h-4 w-4 text-primary flex-shrink-0" />
                                <span className="truncate">{displayName}</span>
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
                      <item.icon className="mr-2 h-4 w-4 text-primary flex-shrink-0" />
                      <span className="truncate">{t(item.titleKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          )
        ))
        )}
      </SidebarContent>
      <SidebarFooter className="mb-4">
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

