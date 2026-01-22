import { useState, useEffect, useRef } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import type { Layout, Layouts } from 'react-grid-layout'
import type { DashboardItem, ChartConfig } from '../../types/dashboard'
import { ChartWidget } from './widgets/ChartWidget'
import { TextWidget } from './widgets/TextWidget'
import { MetricWidget } from './widgets/MetricWidget'
import { TableWidget } from './widgets/TableWidget'
import { RadiusDashboardWidget } from './RadiusDashboardWidget'
import { Button } from '../ui/button'
import { Pencil, Trash2, GripVertical } from 'lucide-react'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveGridLayout = WidthProvider(Responsive)

interface DashboardGridProps {
  items: DashboardItem[]
  onLayoutChange?: (items: DashboardItem[]) => void
  onEditItem?: (item: DashboardItem) => void
  onDeleteItem?: (itemId: string) => void
  isEditing?: boolean
}

export function DashboardGrid({
  items,
  onLayoutChange,
  onEditItem,
  onDeleteItem,
  isEditing = false,
}: DashboardGridProps) {
  const layout: Layout[] = items.map((item) => ({
    i: item.id,
    x: item.layout.x,
    y: item.layout.y,
    w: item.layout.w,
    h: item.layout.h,
  }))

  const layouts: Layouts = {
    lg: layout,
    md: layout.map(l => ({ ...l, w: Math.min(l.w, 12) })),
    sm: layout.map(l => ({ ...l, w: Math.min(l.w, 8), x: 0 })),
    xs: layout.map(l => ({ ...l, w: 4, x: 0 })),
    xxs: layout.map(l => ({ ...l, w: 2, x: 0 }))
  }

  const handleLayoutChange = (newLayout: Layout[]) => {
    if (onLayoutChange) {
      const updatedItems = items.map((item) => {
        const layoutItem = newLayout.find((l) => l.i === item.id)
        if (layoutItem) {
          return {
            ...item,
            layout: {
              x: layoutItem.x,
              y: layoutItem.y,
              w: layoutItem.w,
              h: layoutItem.h,
            },
          }
        }
        return item
      })
      onLayoutChange(updatedItems)
    }
  }

  const renderWidget = (item: DashboardItem) => {
    switch (item.type) {
      case 'chart':
        // Check if this is a RADIUS data source chart
        const chartConfig = item.config as ChartConfig
        if (chartConfig.dataSource === 'radius-users') {
          return <RadiusDashboardWidget title={item.title} config={chartConfig} />
        }
        return <ChartWidget item={item} />
      case 'text':
        return <TextWidget item={item} />
      case 'metric':
        return <MetricWidget item={item} />
      case 'table':
        return <TableWidget item={item} />
      default:
        return null
    }
  }

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <GridLayout
        key={`grid-24-${width}`}
        className={isEditing ? 'layout dashboard-grid-editing' : 'layout'}
        layout={layout}
        cols={24}
        rowHeight={60}
        wstyle={{ width: '100%' }}>
      <ResponsiveGridLayout
        className={isEditing ? 'layout dashboard-grid-editing' : 'layout'}
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 24, md: 12, sm: 8, xs: 4, xxs: 2 }}
        rowHeight={608]}
        containerPadding={[0, 0]}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            {isEditing && (
              <div className="absolute top-2 right-2 z-10 flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 cursor-move"
                >
                  <GripVertical className="h-4 w-4" />
                </Button>
                {onEditItem && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => onEditItem(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {onDeleteItem && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                    onClick={() => onDeleteItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
            <div className="h-full w-full overflow-auto">{renderWidget(item)}</div>
          </div>
        ))}
      </GridLayout>
    </div>
  )
}
Responsive