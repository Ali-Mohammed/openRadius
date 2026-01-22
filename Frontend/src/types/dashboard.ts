export interface FilterCondition {
  id: string
  field: string
  column: string
  operator: string
  value: string | string[] | number | boolean | null
  value2?: string | number | null
}

export interface FilterGroup {
  id: string
  logic: 'and' | 'or'
  conditions: FilterCondition[]
}

export interface ChartConfig {
  chartType: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'gauge' | 'radar' | 'donut' | 'number'
  dataSource?: 'radius-users' | 'manual'
  filterGroup?: FilterGroup
  disaggregationField?: string // Field to group by (e.g., 'profileId', 'tags', 'status')
  aggregationType?: 'count' | 'sum' | 'avg' // How to aggregate data
  valueField?: string // Which field to aggregate (for sum/avg)
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
  icon?: string
  color?: string
  tabs: DashboardTab[]
  globalFilters: GlobalFilter[]
  createdAt: string
  updatedAt: string
  // List view only properties
  tabCount?: number
  itemCount?: number
}
