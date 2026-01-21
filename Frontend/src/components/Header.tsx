import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useKeycloak } from '../contexts/KeycloakContext'
import { useTheme } from '../contexts/ThemeContext'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Avatar, AvatarFallback } from './ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from './ui/dropdown-menu'
import { Moon, Sun, User, LogOut, Settings, Palette, Languages, Maximize2, Minimize2, Menu, ShieldAlert, X } from 'lucide-react'
import { usersApi } from '../lib/api'
import { appConfig } from '../config/app.config'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from './ui/button'

export const Header = () => {
  const { keycloak, authenticated } = useKeycloak()
  const { theme, toggleTheme, primaryColor, setPrimaryColor, layout, setLayout } = useTheme()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [impersonationData, setImpersonationData] = useState<any>(null)

  // Fetch all users to find current user
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAllUsers,
    enabled: authenticated && !!keycloak.token,
  })

  const exitImpersonationMutation = useMutation({
    mutationFn: usersApi.exitImpersonation,
    onSuccess: () => {
      sessionStorage.removeItem('impersonation')
      toast.success("Impersonation ended. You have returned to your account")
      window.location.reload()
    },
  })

  useEffect(() => {
    // Check if in impersonation mode
    const impersonationStr = sessionStorage.getItem('impersonation')
    if (impersonationStr) {
      try {
        const data = JSON.parse(impersonationStr)
        setImpersonationData(data)
        console.log('Header: Impersonation data loaded:', data)
      } catch (e) {
        console.error('Header: Failed to parse impersonation data:', e)
        sessionStorage.removeItem('impersonation')
      }
    } else {
      console.log('Header: No impersonation data in session')
    }
  }, [])

  const isImpersonating = !!impersonationData
  
  console.log('Header render - isImpersonating:', isImpersonating, 'data:', impersonationData)
  
  const email = keycloak.tokenParsed?.email
  const dbUser = users.find((u: any) => u.email === email)

  const handleLogout = () => {
    keycloak.logout()
  }

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
    localStorage.setItem('language', lng)
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lng
  }

  const getUserInitials = () => {
    if (dbUser) {
      return `${dbUser.firstName[0]}${dbUser.lastName[0]}`.toUpperCase()
    }
    const name = keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username || 'U'
    return name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getDisplayName = () => {
    if (isImpersonating && impersonationData?.impersonatedUser) {
      return `${impersonationData.impersonatedUser.firstName} ${impersonationData.impersonatedUser.lastName}`
    }
    if (dbUser) {
      return `${dbUser.firstName} ${dbUser.lastName}`
    }
    return keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username || t('user.profile')
  }

  const handleExitImpersonation = () => {
    exitImpersonationMutation.mutate()
  }

  if (!authenticated) return null

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className={`flex h-16 items-center justify-between px-6 ${layout === 'full-width' ? 'w-full' : 'max-w-7xl mx-auto'}`}>
          <div className="flex items-center gap-4">
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
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">{t('app.name')}</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">{t('app.welcome')}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Impersonation Badge */}
            {isImpersonating && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium shadow-md">
                <ShieldAlert className="h-4 w-4 animate-pulse" />
                <span>Impersonating: {impersonationData?.impersonatedUser?.firstName}</span>
                <button
                  onClick={handleExitImpersonation}
                  className="ml-2 p-1 hover:bg-amber-600 rounded transition-colors"
                  disabled={exitImpersonationMutation.isPending}
                  title="Exit Impersonation"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="hidden md:flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => changeLanguage(i18n.language === 'en' ? 'ar' : 'en')}
              className="hidden md:flex h-9 px-3 items-center justify-center rounded-lg hover:bg-accent transition-colors text-sm font-medium gap-2"
              aria-label="Toggle language"
            >
              <Languages className="h-4 w-4" />
              <span className="hidden lg:inline">{i18n.language === 'en' ? 'العربية' : 'English'}</span>
            </button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent transition-all duration-200 border border-border/40 hover:border-border shadow-sm hover:shadow">
                  <div className="flex flex-col items-end justify-center hidden sm:flex">
                    <span className="text-sm font-semibold leading-tight">
                      {getDisplayName()}
                    </span>
                    <span className="text-xs text-muted-foreground leading-tight">
                      {keycloak.tokenParsed?.email || ''}
                    </span>
                  </div>
                  <Avatar className="h-9 w-9 ring-2 ring-primary/10 hover:ring-primary/20 transition-all">
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 ring-2 ring-primary/10">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-lg">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-0.5">
                      <p className="text-sm font-semibold leading-none">{getDisplayName()}</p>
                      <p className="text-xs leading-none text-muted-foreground mt-1">
                        {keycloak.tokenParsed?.email}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  {t('user.editProfile')}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    {theme === 'dark' ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
                    {t('settings.theme')}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup value={theme} onValueChange={(value) => value !== theme && toggleTheme()}>
                      <DropdownMenuRadioItem value="light">
                        <Sun className="mr-2 h-4 w-4" />
                        {t('settings.light')}
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="dark">
                        <Moon className="mr-2 h-4 w-4" />
                        {t('settings.dark')}
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Palette className="mr-2 h-4 w-4" />
                    {t('settings.primaryColor')}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup value={primaryColor} onValueChange={setPrimaryColor}>
                      {appConfig.theme.availableColors.map((color) => (
                        <DropdownMenuRadioItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="h-4 w-4 rounded-full" 
                              style={{ background: color.class }}
                            />
                            {color.name}
                          </div>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Languages className="mr-2 h-4 w-4" />
                    {t('settings.language')}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup value={i18n.language} onValueChange={changeLanguage}>
                      <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="ar">العربية</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    {layout === 'full-width' ? <Maximize2 className="mr-2 h-4 w-4" /> : <Minimize2 className="mr-2 h-4 w-4" />}
                    {t('settings.layout')}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup value={layout} onValueChange={(value) => setLayout(value as 'boxed' | 'full-width')}>
                      <DropdownMenuRadioItem value="boxed">
                        <Minimize2 className="mr-2 h-4 w-4" />
                        {t('settings.boxed')}
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="full-width">
                        <Maximize2 className="mr-2 h-4 w-4" />
                        {t('settings.fullWidth')}
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('auth.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  )
}
