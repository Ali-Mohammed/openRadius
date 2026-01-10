export interface ChartConfig {
  chartType: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'gauge' | 'radar'
  dataSource?: string
  options?: any
}

export interface TextConfig {
  content: string
  fontSize?: number
  alignment?: 'left' | 'center' | 'right'
}

export interface MetricConfig {
  value: number | string
  label: string
  prefix?: string
  suffix?: string
  trend?: number
  trendDirection?: 'up' | 'down'
}

export interface TableConfig {
  columns: Array<{ key: string; label: string }>
  data: any[]
}

export type DashboardItem = {
  id: string
  type: 'chart' | 'text' | 'metric' | 'table'
  title: string
  layout: {
    x: number
    y: number
    w: number
    h: number
  }
  config: ChartConfig | TextConfig | MetricConfig | TableConfig
}

export type GlobalFilter = {
  id: string
  label: string
  type: 'date' | 'select' | 'multiselect' | 'text'
  value: any
  options?: Array<{ label: string; value: any }>
}

export type DashboardTab = {
  id: string
  name: string
  items: DashboardItem[]
}

export type Dashboard = {
  id: string
  name: string
  description?: string
  tabs: DashboardTab[]
  globalFilters: GlobalFilter[]
  createdAt: string
  updatedAt: string
  // List view only properties
  tabCount?: number
  itemCount?: number
}
