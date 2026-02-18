

// AppSidebar.tsx (обновленная версия)
import * as React from "react"

import {
  Sidebar,
  SidebarContent,
} from "./ui/sidebar"


interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  children?: React.ReactNode
  basePath?: string
}

export const AppSidebar = React.forwardRef<HTMLDivElement, AppSidebarProps>(
  ({ children, basePath, ...props }, ref) => {
    return (
      <Sidebar ref={ref} collapsible="offcanvas" {...props}>
        <SidebarContent>
          {children }
        </SidebarContent>
      </Sidebar>
    )
  }
)
