import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Wallet,
  CreditCard,
  DollarSign,
  TrendingUp,
  Gift,
  Coins,
  Banknote,
  PiggyBank,
} from 'lucide-react'

export const iconMap: Record<string, typeof Wallet> = {
  Wallet,
  CreditCard,
  DollarSign,
  TrendingUp,
  Gift,
  Coins,
  Banknote,
  PiggyBank,
}

export const iconOptions = [
  { value: 'Wallet', label: 'Wallet', icon: Wallet },
  { value: 'CreditCard', label: 'Credit Card', icon: CreditCard },
  { value: 'DollarSign', label: 'Dollar Sign', icon: DollarSign },
  { value: 'TrendingUp', label: 'Trending Up', icon: TrendingUp },
  { value: 'Gift', label: 'Gift', icon: Gift },
  { value: 'Coins', label: 'Coins', icon: Coins },
  { value: 'Banknote', label: 'Banknote', icon: Banknote },
  { value: 'PiggyBank', label: 'Piggy Bank', icon: PiggyBank },
]

interface IconPickerProps {
  value?: string
  onValueChange: (value: string) => void
  label?: string
  required?: boolean
}

export function IconPicker({ value, onValueChange, label = 'Icon', required = false }: IconPickerProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="icon">
        {label} {required && '*'}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue>
            {value && (
              <div className="flex items-center gap-2">
                {(() => {
                  const SelectedIcon = iconMap[value] || Wallet
                  return <SelectedIcon className="h-4 w-4" />
                })()}
                {iconOptions.find((i) => i.value === value)?.label || value}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {iconOptions.map((iconOption) => {
            const IconComp = iconOption.icon
            return (
              <SelectItem key={iconOption.value} value={iconOption.value}>
                <div className="flex items-center gap-2">
                  <IconComp className="h-4 w-4" />
                  {iconOption.label}
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
