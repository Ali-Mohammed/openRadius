import * as React from "react"
import { ChevronRight } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"

import { SearchForm } from "@/components/search-form"
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
// TODO: Make instant ID dynamic based on selected/active instant
const DEFAULT_INSTANT_ID = 1

const data = {
  versions: ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"],
  navMain: [
    {
      title: "Integration",
      url: "#",
      items: [
        {
          title: "SAS Radius",
          url: "/integration/sas-radius",
        },
      ],
    },
    {
      title: "Radius",
      url: "#",
      items: [
        {
          title: "Users",
          url: `/instant/${DEFAULT_INSTANT_ID}/radius/users`,
        },
        {
          title: "Profiles",
          url: `/instant/${DEFAULT_INSTANT_ID}/radius/profiles`,
        },
      ],
    },
    {
      title: "Instant",
      url: "#",
      items: [
        {
          title: "View",
          url: "/instant/view",
        },
        {
          title: "Setting",
          url: "/instant/setting",
        },
      ],
    },
    {
      title: "App Setting",
      url: "#",
      items: [
        {
          title: "OIDC",
          url: "/settings/oidc",
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { theme, primaryColor } = useTheme()
  const { t } = useTranslation()
  const location = useLocation()

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
        <SearchForm />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {/* We create a collapsible SidebarGroup for each parent. */}
        {data.navMain.map((item) => (
          <Collapsible
            key={item.title}
            title={item.title}
            defaultOpen
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel
                asChild
                className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
              >
                <CollapsibleTrigger>
                  {item.title}{" "}
                  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {item.items.map((subItem) => (
                      <SidebarMenuItem key={subItem.title}>
                        <SidebarMenuButton asChild isActive={location.pathname === subItem.url}>
                          <Link to={subItem.url}>{subItem.title}</Link>
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
