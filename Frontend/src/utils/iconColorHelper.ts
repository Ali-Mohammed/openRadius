import {
  Tag as TagIcon, Star, Heart, Zap, Trophy, Crown, Shield,
  Users, User, Building, Briefcase, Rocket, Target, Award, Medal, Flag,
  CheckCircle, XCircle, AlertCircle, Info, Settings, Home, Mail, Phone,
  Calendar, DollarSign, CreditCard, ShoppingCart, Package, Truck,
  MapPin, Globe, Wifi, Database, Server, Cloud, Lock, Key, Eye, Bell,
  MessageCircle, Send, Bookmark, Archive, FileText, Folder, Download, Upload,
  Share, Link, Layers, Grid, List, Filter, Search, Circle,
  Square, Triangle, Diamond, Hexagon, Octagon, Sparkles, Coffee, Music,
  Camera, Image, Video, Mic, Headphones, Speaker, Monitor, Smartphone, Tablet,
  Watch, Printer, Cpu, HardDrive, Battery, Bluetooth, Radio, Rss,
  Building2,
  type LucideIcon
} from 'lucide-react'

export interface ColorOption {
  value: string
  label: string
}

export interface IconOption {
  name: string
  icon: LucideIcon
}

export const PREDEFINED_COLORS: ColorOption[] = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#14b8a6', label: 'Teal' },
]

export const AVAILABLE_ICONS: IconOption[] = [
  { name: 'Building2', icon: Building2 },
  { name: 'Tag', icon: TagIcon },
  { name: 'Star', icon: Star },
  { name: 'Heart', icon: Heart },
  { name: 'Zap', icon: Zap },
  { name: 'Trophy', icon: Trophy },
  { name: 'Crown', icon: Crown },
  { name: 'Shield', icon: Shield },
  { name: 'Users', icon: Users },
  { name: 'User', icon: User },
  { name: 'Building', icon: Building },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Rocket', icon: Rocket },
  { name: 'Target', icon: Target },
  { name: 'Award', icon: Award },
  { name: 'Medal', icon: Medal },
  { name: 'Flag', icon: Flag },
  { name: 'CheckCircle', icon: CheckCircle },
  { name: 'XCircle', icon: XCircle },
  { name: 'AlertCircle', icon: AlertCircle },
  { name: 'Info', icon: Info },
  { name: 'Settings', icon: Settings },
  { name: 'Home', icon: Home },
  { name: 'Mail', icon: Mail },
  { name: 'Phone', icon: Phone },
  { name: 'Calendar', icon: Calendar },
  { name: 'DollarSign', icon: DollarSign },
  { name: 'CreditCard', icon: CreditCard },
  { name: 'ShoppingCart', icon: ShoppingCart },
  { name: 'Package', icon: Package },
  { name: 'Truck', icon: Truck },
  { name: 'MapPin', icon: MapPin },
  { name: 'Globe', icon: Globe },
  { name: 'Wifi', icon: Wifi },
  { name: 'Database', icon: Database },
  { name: 'Server', icon: Server },
  { name: 'Cloud', icon: Cloud },
  { name: 'Lock', icon: Lock },
  { name: 'Key', icon: Key },
  { name: 'Eye', icon: Eye },
  { name: 'Bell', icon: Bell },
  { name: 'MessageCircle', icon: MessageCircle },
  { name: 'Send', icon: Send },
  { name: 'Bookmark', icon: Bookmark },
  { name: 'Archive', icon: Archive },
  { name: 'FileText', icon: FileText },
  { name: 'Folder', icon: Folder },
  { name: 'Download', icon: Download },
  { name: 'Upload', icon: Upload },
  { name: 'Share', icon: Share },
  { name: 'Link', icon: Link },
  { name: 'Layers', icon: Layers },
  { name: 'Grid', icon: Grid },
  { name: 'List', icon: List },
  { name: 'Filter', icon: Filter },
  { name: 'Search', icon: Search },
  { name: 'Circle', icon: Circle },
  { name: 'Square', icon: Square },
  { name: 'Triangle', icon: Triangle },
  { name: 'Diamond', icon: Diamond },
  { name: 'Hexagon', icon: Hexagon },
  { name: 'Octagon', icon: Octagon },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Coffee', icon: Coffee },
  { name: 'Music', icon: Music },
  { name: 'Camera', icon: Camera },
  { name: 'Image', icon: Image },
  { name: 'Video', icon: Video },
  { name: 'Mic', icon: Mic },
  { name: 'Headphones', icon: Headphones },
  { name: 'Speaker', icon: Speaker },
  { name: 'Monitor', icon: Monitor },
  { name: 'Smartphone', icon: Smartphone },
  { name: 'Tablet', icon: Tablet },
  { name: 'Watch', icon: Watch },
  { name: 'Printer', icon: Printer },
  { name: 'Cpu', icon: Cpu },
  { name: 'HardDrive', icon: HardDrive },
  { name: 'Battery', icon: Battery },
  { name: 'Bluetooth', icon: Bluetooth },
  { name: 'Radio', icon: Radio },
  { name: 'Rss', icon: Rss },
]

/**
 * Get icon component by name with fallback to default
 */
export const getIconComponent = (iconName?: string, defaultIcon: LucideIcon = Building2): LucideIcon => {
  if (!iconName) return defaultIcon
  const iconData = AVAILABLE_ICONS.find(i => i.name === iconName)
  return iconData?.icon || defaultIcon
}

/**
 * Get color label by value
 */
export const getColorLabel = (colorValue: string): string => {
  const color = PREDEFINED_COLORS.find(c => c.value === colorValue)
  return color?.label || 'Blue'
}
