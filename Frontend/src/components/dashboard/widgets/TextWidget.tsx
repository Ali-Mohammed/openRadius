import type { DashboardItem, TextConfig } from '../../../types/dashboard'

interface TextWidgetProps {
  item: DashboardItem
}

export function TextWidget({ item }: TextWidgetProps) {
  const config = item.config as TextConfig

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
      <div
        className="flex-1 overflow-auto"
        style={{
          fontSize: config.fontSize || 14,
          textAlign: config.alignment || 'left',
        }}
      >
        {config.content}
      </div>
    </div>
  )
}
