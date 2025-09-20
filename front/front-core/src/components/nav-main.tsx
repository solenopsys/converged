"use client"

import { ChevronRight } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { Action } from "../plugin/types_actions";
import { MenuItem } from "../controllers/menu-store";

export function NavMain({
  items,
  onSelect,
}: {
  items: MenuItem[]
  onSelect?: (actionId:string) => void
}) {

 console.log("NavMain inside", items);

  const handleItemClick = (action:Action<any, any>) => {
    console.log("handleItemClick", action);
    onSelect?.(action)
  }

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items?.map((item) => (
          <Collapsible key={item.title} asChild defaultOpen={item.isActive}>
            <SidebarMenuItem>
              <SidebarMenuButton 
                tooltip={item.title}
                onClick={() => handleItemClick(item.action)}
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
              >
                {item.icon} 
                <span>{item.title}</span>
              </SidebarMenuButton>
              {item.items?.length ? (
                <>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction className="data-[state=open]:rotate-90 cursor-pointer">
                      <ChevronRight />
                      <span className="sr-only">Toggle</span>
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton 
                            onClick={() => handleItemClick(subItem.action)}
                            className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                          >
                            <span>{subItem.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </>
              ) : null}
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}