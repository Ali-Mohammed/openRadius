import type { DashboardItem, MetricConfig } from '../../../types/dashboard'
import { ArrowUp, ArrowDown } from 'lucide-react'

interface MetricWidgetProps {
  item: DashboardItem
}

export function MetricWidget({ item }: MetricWidgetProps) {
  const config = item.config as MetricConfig

  return (
    <div className="h-full flex flex-col justify-center items-center">
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{config.label}</div>
      <div className="text-4xl font-bold text-gray-900 dark:text-white">
        {config.prefix}
        {config.value}
        {config.suffix}
      </div>
      {config.trend !== undefined && (
        <div
          className={`mt-2 flex items-center gap-1 text-sm ${
            config.trendDirection === 'up'
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {config.trendDirection === 'up' ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )}
          <span>{Math.abs(config.trend)}%</span>
        </div>
      )}
    </div>
  )
}
