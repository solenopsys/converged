 

// AppSidebar.tsx (обновленная версия)
import * as React from "react" 

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useGlobalTranslation } from "@/hooks/global_i18n"


interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  children?: React.ReactNode
}

export const AppSidebar = React.forwardRef<HTMLDivElement, AppSidebarProps>(
  ({ children, ...props }, ref) => {
    const { i18n } = useGlobalTranslation("menu")
    const user = i18n.t("user", { ns: "menu", returnObjects: true }) || {}

    return (
      <Sidebar ref={ref} collapsible="offcanvas" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="#">
                  <img src="/assets/logo.svg" alt="logo" className="!h-6 !w-auto" />
                  <span className="text-small font-semibold">CONVERGED</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          {children }
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={user} />
        </SidebarFooter>
      </Sidebar>
    )
  }
)
 