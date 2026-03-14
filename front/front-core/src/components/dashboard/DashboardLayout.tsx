import * as React from "react"
import { cn } from "../../lib/utils"
import { ScrollArea } from "../ui/scroll-area"

interface DashboardLayoutProps {
  children: React.ReactNode
  className?: string
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  return (
    <ScrollArea className="h-full">
      <div className={cn("space-y-4", className)}>{children}</div>
    </ScrollArea>
  )
}
