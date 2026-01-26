import * as React from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Users,
  CircleUser,
  Settings,
  LayoutDashboard,
  Radio,
  Eye,
  Wrench,
  Key,
  DollarSign,
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
  Activity,
  ArrowUpCircle,
  Receipt,
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
} from "lucide-react"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface NavItem {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  keywords?: string[]
}

interface NavGroup {
  title: string
  items: NavItem[]
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const navGroups: NavGroup[] = [
    {
      title: t("navigation.dashboards"),
      items: [
        { title: t("navigation.dashboards"), url: "/dashboards", icon: LayoutDashboard, keywords: ["home", "overview", "analytics"] },
      ],
    },
    {
      title: t("navigation.radius"),
      items: [
        { title: t("navigation.users"), url: "/radius/users", icon: Users, keywords: ["radius users", "subscribers", "customers"] },
        { title: t("navigation.profiles"), url: "/radius/profiles", icon: CircleUser, keywords: ["radius profiles", "plans"] },
        { title: t("navigation.groups"), url: "/radius/groups", icon: UsersRound, keywords: ["radius groups"] },
        { title: t("navigation.tags"), url: "/radius/tags", icon: Tag, keywords: ["labels", "markers"] },
        { title: t("navigation.nas"), url: "/radius/nas", icon: Server, keywords: ["network access server", "router"] },
        { title: t("navigation.ipPools"), url: "/radius/ip-pools", icon: Network, keywords: ["ip address", "dhcp"] },
        { title: t("navigation.ipReservations"), url: "/radius/ip-reservations", icon: Layers, keywords: ["static ip", "reserved"] },
        { title: t("navigation.customAttributes"), url: "/radius/custom-attributes", icon: Settings, keywords: ["attributes", "fields"] },
        { title: t("navigation.zones"), url: "/radius/zones", icon: MapPin, keywords: ["areas", "regions", "locations"] },
        { title: t("navigation.activations"), url: "/radius/activations", icon: Activity, keywords: ["activate", "enable"] },
      ],
    },
    {
      title: t("navigation.billing"),
      items: [
        { title: t("navigation.billingProfiles"), url: "/billing/profiles", icon: FileText, keywords: ["billing plans", "pricing"] },
        { title: t("navigation.activationHistory"), url: "/billing/activation-history", icon: History, keywords: ["activations", "history", "audit"] },
        { title: t("navigation.addons"), url: "/billing/addons", icon: Package, keywords: ["extras", "add-ons"] },
        { title: t("navigation.groups"), url: "/billing/groups", icon: TrendingUp, keywords: ["billing groups"] },
        { title: t("navigation.cashbacks"), url: "/billing/cashbacks", icon: Gift, keywords: ["rewards", "refunds"] },
        { title: t("navigation.cashbackGroups"), url: "/billing/cashback-groups", icon: PiggyBank, keywords: ["cashback groups"] },
        { title: t("navigation.customWallets"), url: "/billing/wallets", icon: Wallet, keywords: ["wallets", "accounts"] },
        { title: t("navigation.userWallets"), url: "/billing/user-wallets", icon: WalletCards, keywords: ["user wallets", "balances"] },
        { title: t("navigation.topUp"), url: "/billing/topup", icon: ArrowUpCircle, keywords: ["recharge", "add funds"] },
        { title: t("navigation.walletHistory"), url: "/billing/history", icon: History, keywords: ["transactions", "logs"] },
        { title: t("navigation.transactions"), url: "/billing/transactions", icon: Receipt, keywords: ["payments", "invoices"] },
        { title: t("navigation.balances"), url: "/billing/balances", icon: Coins, keywords: ["credit", "balance"] },
        { title: t("navigation.automations"), url: "/billing/automations", icon: Zap, keywords: ["workflows", "automation"] },
      ],
    },
    {
      title: t("navigation.network"),
      items: [
        { title: t("navigation.olts"), url: "/network/olts", icon: Cable, keywords: ["optical", "fiber"] },
        { title: t("navigation.fdts"), url: "/network/fdts", icon: Box, keywords: ["distribution"] },
        { title: t("navigation.fats"), url: "/network/fats", icon: SquareStack, keywords: ["access terminal"] },
        { title: t("navigation.provisioning"), url: "/network/provisioning", icon: Globe, keywords: ["setup", "configure"] },
        { title: t("navigation.monitoring"), url: "/network/monitoring", icon: Monitor, keywords: ["status", "health"] },
        { title: t("navigation.networkReports"), url: "/network/reports", icon: BarChart3, keywords: ["analytics", "statistics"] },
        { title: t("navigation.networkSettings"), url: "/network/settings", icon: Cog, keywords: ["configuration"] },
      ],
    },
    {
      title: t("navigation.connectors"),
      items: [
        { title: t("navigation.connectorList"), url: "/connectors", icon: FileStack, keywords: ["integrations", "connections"] },
        { title: t("navigation.cdcMonitor"), url: "/cdc-monitor", icon: Activity, keywords: ["change data capture", "sync"] },
        { title: t("navigation.connectorSettings"), url: "/connectors/settings", icon: Wrench, keywords: ["connector configuration"] },
      ],
    },
    {
      title: t("navigation.appSetting"),
      items: [
        { title: t("navigation.workspace"), url: "/workspace/view", icon: Eye, keywords: ["workspace", "tenant"] },
        { title: t("navigation.general"), url: "/settings/general", icon: DollarSign, keywords: ["general settings", "preferences"] },
        { title: t("navigation.paymentInformation"), url: "/settings/payment-history", icon: CreditCard, keywords: ["payment", "history", "transactions", "zaincash", "qicard", "switch"] },
        { title: t("navigation.oidc"), url: "/settings/oidc", icon: Key, keywords: ["authentication", "sso", "login"] },
        { title: t("navigation.databaseBackup"), url: "/settings/database-backup", icon: HardDrive, keywords: ["backup", "restore", "export"] },
        { title: t("navigation.integrations"), url: "/integrations", icon: Radio, keywords: ["third party", "api"] },
      ],
    },
    {
      title: t("navigation.userManagement"),
      items: [
        { title: t("navigation.users"), url: "/users", icon: UserCheck, keywords: ["admin users", "staff"] },
        { title: t("navigation.roles"), url: "/roles", icon: Shield, keywords: ["permissions", "access"] },
        { title: t("navigation.permissions"), url: "/permissions", icon: Lock, keywords: ["authorization", "rights"] },
        { title: t("navigation.userGroups"), url: "/groups", icon: UserRound, keywords: ["teams", "departments"] },
      ],
    },
  ]

  const handleSelect = (url: string) => {
    navigate(url)
    onOpenChange(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t("search.placeholder", "Type to search...")} />
      <CommandList>
        <CommandEmpty>{t("search.noResults", "No results found.")}</CommandEmpty>
        {navGroups.map((group, groupIndex) => (
          <React.Fragment key={group.title}>
            <CommandGroup heading={group.title}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.url}
                  value={`${item.title} ${item.keywords?.join(" ") || ""}`}
                  onSelect={() => handleSelect(item.url)}
                  className="cursor-pointer"
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {groupIndex < navGroups.length - 1 && <CommandSeparator />}
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  )
}