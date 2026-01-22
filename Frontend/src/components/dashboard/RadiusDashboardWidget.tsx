import { useEffect, useState } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Loader2 } from 'lucide-react'
import { apiClient } from '../../lib/api'
import type { ChartConfig } from '../../types/dashboard'

interface RadiusDashboardWidgetProps {
  title: string
  config: ChartConfig
}

interface DashboardData {
  name: string
  value: number
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export function RadiusDashboardWidget({ title, config }: RadiusDashboardWidgetProps) {
  const [data, setData] = useState<DashboardData[] | { value: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [config])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiClient.post('/api/dashboard/radius-data', {
        disaggregationField: config.disaggregationField || null,
        aggregationType: config.aggregationType || 'count',
        valueField: config.valueField || null,
        filterGroup: config.filterGroup || null,
      })

      setData(response.data)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  // Single value display (no disaggregation)
  if (data && 'value' in data && config.chartType === 'number') {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[calc(100%-4rem)]">
          <div className="text-center">
            <div className="text-5xl font-bold text-primary">{data.value.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground mt-2">
              {config.aggregationType === 'count' ? 'Total Users' :
               config.aggregationType === 'sum' ? `Total ${config.valueField}` :
               `Average ${config.valueField}`}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Chart display (with disaggregation)
  const chartData = Array.isArray(data) ? data : []

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-4rem)]">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {config.chartType === 'bar' && (
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Bar dataKey="value" fill="#3b82f6" name={
                  config.aggregationType === 'count' ? 'Count' :
                  config.aggregationType === 'sum' ? `Total ${config.valueField}` :
                  `Average ${config.valueField}`
                } />
              </BarChart>
            )}
            
            {config.chartType === 'line' && (
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} name={
                  config.aggregationType === 'count' ? 'Count' :
                  config.aggregationType === 'sum' ? `Total ${config.valueField}` :
                  `Average ${config.valueField}`
                } />
              </LineChart>
            )}
            
            {config.chartType === 'area' && (
              <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="value" fill="#3b82f6" stroke="#3b82f6" name={
                  config.aggregationType === 'count' ? 'Count' :
                  config.aggregationType === 'sum' ? `Total ${config.valueField}` :
                  `Average ${config.valueField}`
                } />
              </AreaChart>
            )}
            
            {(config.chartType === 'pie' || config.chartType === 'donut') && (
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={config.chartType === 'donut' ? 80 : 100}
                  innerRadius={config.chartType === 'donut' ? 50 : 0}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
              </PieChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
