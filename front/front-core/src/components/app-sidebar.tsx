import * as React from "react"
import * as TablerIcons from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
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
import { useMenu } from "@/hooks/menu"

const renderIcon = (iconName: string) => {
  if (TablerIcons[iconName]) {
    const IconComponent = TablerIcons[iconName]
    return React.createElement(IconComponent)
  }
  return null
}

const processItems = (items: any[]) => {
  if (!Array.isArray(items)) return []

  return items.map(item => {
    const processedItem = { ...item }

    if (processedItem.iconName) {
      processedItem.icon = renderIcon(processedItem.iconName)
      delete processedItem.iconName
    }

    if (processedItem.items && processedItem.items.length > 0) {
      processedItem.items = processItems(processedItem.items)
    }

    return processedItem
  })
}

export const AppSidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Sidebar>
>(({ ...props }, ref) => {
  const { i18n } = useGlobalTranslation("menu")

  const navMain = processItems(useMenu());
 

  const navSecondary = processItems(i18n.t("navSecondary", { ns: "menu", returnObjects: true }) || [])
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
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
})

AppSidebar.displayName = "AppSidebar"