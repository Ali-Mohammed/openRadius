import { useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { AppSidebar } from '@/components/app-sidebar'
import { useState, useEffect } from 'react'
import { dashboardApi } from '@/api/dashboardApi'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Moon, Sun, Languages, Home, UserCog, Settings, Building2, Radio, Users, CircleUser, Eye, Wrench, SlidersHorizontal, Key, Server, Network, LayoutDashboard, Database } from 'lucide-react'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()
  const { theme, toggleTheme, layout } = useTheme()
  const { t, i18n } = useTranslation()
  const [dashboardName, setDashboardName] = useState<string>('')

  // Load dashboard name when on a dashboard detail page
  useEffect(() => {
    const loadDashboardName = async () => {
      const match = location.pathname.match(/\/dashboards\/(\d+)/)
      if (match) {
        try {
          const dashboard = await dashboardApi.getDashboard(match[1])
          setDashboardName(dashboard.name)
        } catch (error) {
          console.error('Error loading dashboard:', error)
          setDashboardName('Dashboard')
        }
      } else {
        setDashboardName('')
      }
    }
    loadDashboardName()
  }, [location.pathname])

  const getBreadcrumbs = () => {
    if (location.pathname === '/dashboard') return { parent: null, current: 'Dashboard', icon: Home }
    if (location.pathname === '/profile') return { parent: null, current: 'Profile Settings', icon: UserCog }
    if (location.pathname === '/settings') return { parent: null, current: 'Settings', icon: SlidersHorizontal }
    if (location.pathname === '/dashboards') return { parent: null, current: 'Dashboards', icon: LayoutDashboard }
    if (location.pathname.match(/\/dashboards\/\d+(\/edit)?$/)) {
      const isEditMode = location.pathname.endsWith('/edit')
      return { 
        parent: { title: 'Dashboards', href: '/dashboards', icon: LayoutDashboard }, 
        current: dashboardName || 'Loading...', 
        icon: LayoutDashboard,
        suffix: isEditMode ? ' (Edit Mode)' : ''
      }
    }
    if (location.pathname === '/workspace/view') return { parent: null, current: 'Workspace View', icon: Eye }
    if (location.pathname.startsWith('/workspace/') && location.pathname.endsWith('/settings')) {
      return { parent: { title: 'Workspace View', href: '/workspace/view', icon: Eye }, current: 'Workspace Settings', icon: Wrench }
    }
    if (location.pathname === '/integration/sas-radius') return { parent: null, current: 'SAS Radius', icon: Radio }
    if (location.pathname.includes('/radius/users')) return { parent: null, current: 'RADIUS Users', icon: Users }
    if (location.pathname.includes('/radius/profiles')) return { parent: null, current: 'RADIUS Profiles', icon: CircleUser }
    if (location.pathname.includes('/radius/nas')) return { parent: null, current: 'Network Access Servers', icon: Server }
    if (location.pathname.includes('/radius/ip-pools')) return { parent: null, current: 'RADIUS IP Pools', icon: Network }
    if (location.pathname.includes('/billing/profiles/new')) {
      return { 
        parent: { title: 'Billing Profiles', href: `/workspace/${location.pathname.split('/')[2]}/billing/profiles`, icon: Settings }, 
        current: 'Create Billing Profile', 
        icon: Settings 
      }
    }
    if (location.pathname.includes('/billing/profiles/edit')) {
      return { 
        parent: { title: 'Billing Profiles', href: `/workspace/${location.pathname.split('/')[2]}/billing/profiles`, icon: Settings }, 
        current: 'Edit Billing Profile', 
        icon: Settings 
      }
    }
    if (location.pathname.includes('/billing/profiles')) return { parent: null, current: 'Billing Profiles', icon: Settings }
    if (location.pathname === '/workspace/setting') return { parent: null, current: 'Workspace Settings', icon: Wrench }
    if (location.pathname === '/settings/oidc') return { parent: null, current: 'OIDC Settings', icon: Key }
    if (location.pathname === '/settings/database-backup') return { parent: null, current: 'Database Backup', icon: Database }
    if (location.pathname.includes('/billing/automations')) {
      // Check if it's the workflow designer page
      if (location.pathname.match(/\/billing\/automations\/\d+\/design/)) {
        return { 
          parent: { title: 'Automations', href: '/billing/automations', icon: Settings }, 
          current: 'Workflow Designer', 
          icon: Settings 
        }
      }
      return { parent: null, current: 'Automations', icon: Settings }
    }
    return { parent: null, current: 'Dashboard', icon: Home }
  }

  const breadcrumbs = getBreadcrumbs()

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
    localStorage.setItem('language', lng)
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lng
  }

  return (
    <SidebarProvider>
      <AppSidebar side={i18n.language === 'ar' ? 'right' : 'left'} />
      <SidebarInset className="overflow-x-hidden">
        <header className="bg-background sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {i18n.language === 'ar' && (
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </button>

              {/* Language Toggle */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex h-9 px-3 items-center justify-center rounded-lg hover:bg-accent transition-colors text-sm font-medium gap-2"
                    aria-label="Change language"
                  >
                    <Languages className="h-4 w-4" />
                    <span className="hidden lg:inline">{i18n.language === 'en' ? 'EN' : 'AR'}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => changeLanguage('en')}>
                    English
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLanguage('ar')}>
                    العربية
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link to="/dashboard" className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-primary" />
                    OpenRadius
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              {breadcrumbs.parent && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={breadcrumbs.parent.href} className="flex items-center gap-2">
                        {breadcrumbs.parent.icon && <breadcrumbs.parent.icon className="h-4 w-4 text-primary" />}
                        {breadcrumbs.parent.title}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage className="flex items-center gap-2">
                  {breadcrumbs.icon && <breadcrumbs.icon className="h-4 w-4 text-primary" />}
                  {breadcrumbs.current}{breadcrumbs.suffix || ''}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {i18n.language !== 'ar' && (
            <div className="ml-auto flex items-center gap-2">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </button>

              {/* Language Toggle */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex h-9 px-3 items-center justify-center rounded-lg hover:bg-accent transition-colors text-sm font-medium gap-2"
                    aria-label="Change language"
                  >
                    <Languages className="h-4 w-4" />
                    <span className="hidden lg:inline">{i18n.language === 'en' ? 'EN' : 'AR'}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => changeLanguage('en')}>
                    English
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLanguage('ar')}>
                    العربية
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </header>
        <div className={`flex flex-1 flex-col gap-4 p-4 ${layout === 'boxed' ? 'mx-auto max-w-7xl w-full' : ''}`}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

