import * as React from "react"
import { cn } from "../../lib/utils"

/**
 * DashboardWidget - единый контроллер размеров для виджетов дашборда.
 *
 * Решает проблему:
 * - Графики и карточки автоматически занимают всё доступное пространство
 * - Не нужно везде прописывать h-full, flex-1, min-h-0
 * - Единая точка управления размерами
 *
 * Использование:
 * <DashboardWidget>
 *   <ChartAreaInteractive />
 * </DashboardWidget>
 */

interface DashboardWidgetProps {
  children: React.ReactNode
  className?: string
}

export function DashboardWidget({ children, className }: DashboardWidgetProps) {
  return (
    <div
      data-slot="dashboard-widget"
      className={cn(
        // Занимает всю ячейку grid
        "h-full w-full",
        // Flex контейнер для управления детьми
        "flex flex-col",
        // Критично для flex children - позволяет сжиматься
        "min-h-0 min-w-0",
        // Overflow для безопасности
        "overflow-hidden",
        className
      )}
    >
      {/*
        Внутренний контейнер который растягивает контент.
        CSS переменная --widget-height доступна детям через контейнер.
      */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col [&>*]:flex-1 [&>*]:min-h-0 [&>*]:h-full">
        {children}
      </div>
    </div>
  )
}

/**
 * Хук для получения размеров виджета (опционально).
 * Использует ResizeObserver для отслеживания изменений.
 */
export function useWidgetSize(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = React.useState({ width: 0, height: 0 })

  React.useEffect(() => {
    if (!ref.current) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])

  return size
}
