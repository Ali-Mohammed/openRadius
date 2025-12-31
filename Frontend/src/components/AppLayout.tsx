import { useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { AppSidebar } from '@/components/app-sidebar'
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
import { Moon, Sun, Languages } from 'lucide-react'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()
  const { theme, toggleTheme, layout } = useTheme()
  const { t, i18n } = useTranslation()

  const getBreadcrumbs = () => {
    if (location.pathname === '/dashboard') return { parent: null, current: 'Dashboard' }
    if (location.pathname === '/profile') return { parent: null, current: 'Profile Settings' }
    if (location.pathname === '/settings') return { parent: null, current: 'Settings' }
    if (location.pathname === '/instant/view') return { parent: null, current: 'Instant View' }
    if (location.pathname.startsWith('/instant/') && location.pathname.endsWith('/settings')) {
      return { parent: { title: 'Instant View', href: '/instant/view' }, current: 'Instant Settings' }
    }
    if (location.pathname === '/integration/sas-radius') return { parent: null, current: 'SAS Radius' }
    return { parent: null, current: 'Dashboard' }
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
      <SidebarInset>
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
                  <Link to="/dashboard">OpenRadius</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              {breadcrumbs.parent && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={breadcrumbs.parent.href}>{breadcrumbs.parent.title}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage>{breadcrumbs.current}</BreadcrumbPage>
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
