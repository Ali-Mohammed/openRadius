import { useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { AppSidebar } from '@/components/app-sidebar'
import { useState, useEffect } from 'react'
import { dashboardApi } from '@/api/dashboardApi'
import { CommandPalette } from '@/components/CommandPalette'
import { useCommandPalette } from '@/hooks/useCommandPalette'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Moon, Sun, Languages, Home, UserCog, Settings, Building2, Radio, Users, CircleUser, Eye, Wrench, SlidersHorizontal, Key, Server, Network, LayoutDashboard, Database, MapPin, Package, Wallet, ArrowUp, History, Receipt, DollarSign, Tags, Activity, ShieldAlert, X } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { usersApi } from '@/lib/api'
import { toast } from 'sonner'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()
  const { theme, toggleTheme, layout } = useTheme()
  const { t, i18n } = useTranslation()
  const [dashboardName, setDashboardName] = useState<string>('')
  const [impersonationData, setImpersonationData] = useState<any>(null)
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [breadcrumbTrigger, setBreadcrumbTrigger] = useState(0)

  // Check for impersonation
  useEffect(() => {
    const checkImpersonation = () => {
      const data = sessionStorage.getItem('impersonation')
      if (data) {
        try {
          const parsed = JSON.parse(data)
          setImpersonationData(parsed)
        } catch (error) {
          console.error('[AppLayout] Error parsing impersonation data:', error)
        }
      } else {
        setImpersonationData(null)
      }
    }

    // Check on mount
    checkImpersonation()

    // Poll for changes every 5 seconds (reduced from 1s for better performance)
    const interval = setInterval(checkImpersonation, 5000)

    // Listen for storage events from other tabs
    window.addEventListener('storage', checkImpersonation)

    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', checkImpersonation)
    }
  }, [])

  // Exit impersonation mutation
  const exitImpersonationMutation = useMutation({
    mutationFn: usersApi.exitImpersonation,
    onSuccess: () => {
      // Get impersonation data to restore original token
      const impersonationData = sessionStorage.getItem('impersonation')
      if (impersonationData) {
        try {
          const parsed = JSON.parse(impersonationData)
          // Restore the original admin's token in keycloak
          if (parsed.originalToken) {
            // The token will be used by API interceptor after reload
            // We just need to clear the impersonation data
          }
        } catch (error) {
          console.error('Failed to parse impersonation data:', error)
        }
      }
      
      sessionStorage.removeItem('impersonation')
      toast.success('Exited impersonation mode')
      window.location.reload()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to exit impersonation')
    }
  })

  const handleExitImpersonation = async () => {
    try {
      await exitImpersonationMutation.mutateAsync()
    } catch (error) {
      console.error('Error exiting impersonation:', error)
    }
  }

  const handleExitClick = () => {
    setShowExitDialog(true)
  }

  const confirmExit = () => {
    setShowExitDialog(false)
    handleExitImpersonation()
  }

  const isImpersonating = !!impersonationData
  const firstName = impersonationData?.impersonatedUser?.firstName || ''

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

  // Listen for breadcrumb updates from child pages
  useEffect(() => {
    const handleBreadcrumbUpdate = () => {
      setBreadcrumbTrigger(prev => prev + 1)
    }
    
    window.addEventListener('breadcrumb-update', handleBreadcrumbUpdate)
    return () => window.removeEventListener('breadcrumb-update', handleBreadcrumbUpdate)
  }, [])

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
    if (location.pathname === '/integrations') return { parent: null, current: 'Integrations', icon: Radio }
    if (location.pathname === '/integrations/sas-radius') {
      return {
        parent: { title: 'Integrations', href: '/integrations', icon: Radio },
        current: 'SAS Radius',
        icon: Radio
      }
    }
    if (location.pathname.match(/\/integrations\/activation-logs\/\d+$/)) {
      return {
        parent: { title: 'Integrations', href: '/integrations', icon: Radio },
        parentSecondary: { title: 'SAS Radius', href: '/integrations/sas-radius', icon: Radio },
        current: 'Activation Logs',
        icon: Activity
      }
    }
    if (location.pathname.match(/\/integrations\/sessions-sync\/\d+$/)) {
      return {
        parent: { title: 'Integrations', href: '/integrations', icon: Radio },
        parentSecondary: { title: 'SAS Radius', href: '/integrations/sas-radius', icon: Radio },
        current: 'SAS Integration Sessions Sync',
        icon: Activity
      }
    }
    if (location.pathname.includes('/radius/users')) {
      // Check if it's a user detail page
      const userIdMatch = location.pathname.match(/\/radius\/users\/(\d+)(\/([a-z]+))?$/)
      if (userIdMatch) {
        const username = document.getElementById('user-detail-breadcrumb')?.textContent || 'User Details'
        const tab = userIdMatch[3]
        const tabNames: Record<string, string> = {
          overview: 'Overview',
          edit: 'Edit',
          traffic: 'Traffic',
          sessions: 'Sessions',
          invoices: 'Invoices',
          payments: 'Payments',
          history: 'History',
          documents: 'Documents',
          freezonetraffic: 'FreeZone Traffic',
          quota: 'Quota'
        }
        
        if (tab && tabNames[tab]) {
          return {
            parent: { title: 'RADIUS Users', href: '/radius/users', icon: Users },
            parentSecondary: { title: username, href: `/radius/users/${userIdMatch[1]}`, icon: Users },
            current: tabNames[tab],
            icon: Users
          }
        }
        
        return {
          parent: { title: 'RADIUS Users', href: '/radius/users', icon: Users },
          current: username,
          icon: Users
        }
      }
      return { parent: null, current: 'RADIUS Users', icon: Users }
    }
    if (location.pathname.includes('/radius/profiles')) return { parent: null, current: 'RADIUS Profiles', icon: CircleUser }
    if (location.pathname.includes('/radius/groups')) return { parent: null, current: 'RADIUS Groups', icon: Users }
    if (location.pathname.includes('/radius/tags')) return { parent: null, current: 'RADIUS Tags', icon: Tags }
    if (location.pathname.includes('/radius/nas')) return { parent: null, current: 'Network Access Servers', icon: Server }
    if (location.pathname.includes('/radius/ip-pools')) return { parent: null, current: 'RADIUS IP Pools', icon: Network }
    if (location.pathname.includes('/radius/ip-reservations')) return { parent: null, current: 'IP Reservations', icon: Network }
    if (location.pathname.includes('/radius/custom-attributes')) return { parent: null, current: 'Custom Attributes', icon: Settings }
    if (location.pathname.includes('/radius/zones')) return { parent: null, current: 'Zones', icon: MapPin }
    if (location.pathname.includes('/radius/activations')) return { parent: null, current: 'Activations', icon: Activity }
    if (location.pathname.includes('/billing/profiles/new')) {
      return {
        parent: { title: 'Billing Profiles', href: '/billing/profiles', icon: Settings },
        current: 'Create Billing Profile', 
        icon: Settings 
      }
    }
    if (location.pathname.includes('/billing/profiles/edit')) {
      return {
        parent: { title: 'Billing Profiles', href: '/billing/profiles', icon: Settings },
        current: 'Edit Billing Profile', 
        icon: Settings 
      }
    }
    if (location.pathname.includes('/billing/profiles')) return { parent: null, current: 'Billing Profiles', icon: Settings }
    if (location.pathname.includes('/billing/activation-history')) return { parent: null, current: 'Activation History', icon: History }
    if (location.pathname.includes('/billing/addons')) return { parent: null, current: 'Addons', icon: Package }
    if (location.pathname.includes('/billing/groups')) return { parent: null, current: 'Billing Groups', icon: Users }
    if (location.pathname.includes('/billing/cashbacks')) return { parent: null, current: 'Cashback Profiles', icon: DollarSign }
    if (location.pathname.includes('/billing/cashback-groups')) return { parent: null, current: 'Cashback Groups', icon: Users }
    if (location.pathname.includes('/billing/wallets')) return { parent: null, current: 'Custom Wallets', icon: Wallet }
    if (location.pathname.includes('/billing/user-wallets')) return { parent: null, current: 'User Wallets', icon: Wallet }
    if (location.pathname.includes('/billing/topup')) return { parent: null, current: 'Top Up', icon: ArrowUp }
    if (location.pathname.includes('/billing/history')) return { parent: null, current: 'Wallet History', icon: History }
    if (location.pathname.includes('/billing/transactions')) return { parent: null, current: 'Transactions', icon: Receipt }
    if (location.pathname.includes('/billing/balances')) return { parent: null, current: 'Balances', icon: DollarSign }
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
    if (location.pathname.match(/\/microservices\/radius-sync\/[^\/]+$/)) {
      const serviceName = location.pathname.split('/').pop() || 'Service';
      return {
        parent: { title: 'Connected Services', href: '/microservices/radius-sync', icon: Server },
        current: decodeURIComponent(serviceName),
        icon: Server
      }
    }
    if (location.pathname === '/microservices/approvals') {
      return {
        parent: { title: 'Microservices', href: '/microservices/radius-sync', icon: Server },
        current: 'Approvals',
        icon: Server
      }
    }
    if (location.pathname === '/microservices/radius-sync') return { parent: null, current: 'Connected Services', icon: Server }
    return { parent: null, current: 'Dashboard', icon: Home }
  }

  const breadcrumbs = getBreadcrumbs()

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
    localStorage.setItem('language', lng)
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lng
  }

  // Command palette state
  const { open: commandPaletteOpen, setOpen: setCommandPaletteOpen } = useCommandPalette()

  return (
    <SidebarProvider>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <AppSidebar side={i18n.language === 'ar' ? 'right' : 'left'} />
      <SidebarInset className="overflow-x-hidden">
        <header className="bg-background sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {i18n.language === 'ar' && (
            <div className="flex items-center gap-2">
              {/* Impersonation Badge */}
              {isImpersonating && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium shadow-md">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Impersonating: {firstName}</span>
                  <button
                    onClick={handleExitClick}
                    className="ml-1 hover:bg-amber-600 rounded p-0.5 transition-colors"
                    aria-label="Exit impersonation"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              
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
              {breadcrumbs.parentSecondary && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={breadcrumbs.parentSecondary.href} className="flex items-center gap-2">
                        {breadcrumbs.parentSecondary.icon && <breadcrumbs.parentSecondary.icon className="h-4 w-4 text-primary" />}
                        {breadcrumbs.parentSecondary.title}
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
              {/* Impersonation Badge */}
              {isImpersonating && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium shadow-md">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Impersonating: {firstName}</span>
                  <button
                    onClick={handleExitClick}
                    className="ml-1 hover:bg-amber-600 rounded p-0.5 transition-colors"
                    aria-label="Exit impersonation"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              
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
        <div className={`flex flex-1 flex-col ${location.pathname.includes('/designer') ? 'relative' : 'gap-4 p-4'} ${layout === 'boxed' ? 'mx-auto max-w-7xl w-full' : ''}`}>
          {children}
        </div>
      </SidebarInset>

      {/* Exit Impersonation Confirmation Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Impersonation Mode?</AlertDialogTitle>
            <AlertDialogDescription>
              You are currently impersonating <strong>{firstName}</strong>. Are you sure you want to return to your own account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExit}>Exit Impersonation</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}

