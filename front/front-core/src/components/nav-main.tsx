"use client"

import { useEffect } from "react"
import type { CSSProperties } from "react"
import { useUnit } from "effector-react"
import { ChevronRight } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "./ui/sidebar"
import {
  $menuSectionsState,
  menuSectionToggled,
  controllerInitialized,
} from "sidebar-controller"
import { MenuItem } from "../controllers/menu-store"

const getMenuItemId = (item: MenuItem, index: number) => {
  if (item.key) {
    return item.key
  }
  if (item.action && typeof item.action === "string") {
    return item.action
  }
  if (item.action && typeof item.action === "object" && "id" in item.action) {
    return item.action.id as string
  }
  if (item.title) {
    return `title:${item.title}`
  }
  return `item:${index}`
}

export function NavMain({
  items,
  onSelect,
}: {
  items: MenuItem[]
  onSelect?: (actionId:string) => void
}) {

 console.log("NavMain inside", items);

  const menuVars: CSSProperties = {
    "--menu-toggle-col": "1.5rem",
    "--menu-gap": "0.25rem",
    "--menu-sub-extra": "1.25rem",
  }

  const [menuState, initController, toggleMenuSection] = useUnit([
    $menuSectionsState,
    controllerInitialized,
    menuSectionToggled,
  ])

  useEffect(() => {
    initController()
  }, [initController])

  const handleItemClick = (action?: MenuItem["action"] | string) => {
    if (!action) {
      return;
    }
    const actionId = typeof action === "string" ? action : action.id;
    if (!actionId) {
      return;
    }
    console.log("handleItemClick", actionId);
    onSelect?.(actionId)
  }

  return (
    <SidebarGroup style={menuVars}>
      <SidebarMenu>
        {items?.map((item, index) => {
          const itemId = getMenuItemId(item, index)
          const hasSubItems = Boolean(item.items?.length)
          const open =
            hasSubItems ? menuState[itemId] ?? Boolean(item.isActive) : undefined
          const handleOpenChange = (nextOpen: boolean) => {
            if (!hasSubItems) return
            toggleMenuSection({ id: itemId, open: nextOpen })
          }

          return (
          <Collapsible
            key={itemId}
            asChild
            {...(hasSubItems ? { open, onOpenChange: handleOpenChange } : {})}
          >
            <SidebarMenuItem>
              <div className="flex w-full items-center gap-[var(--menu-gap)]">
                {hasSubItems ? (
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      aria-label="Toggle"
                      className="text-sidebar-foreground/70 hover:text-sidebar-foreground group inline-flex h-8 w-[var(--menu-toggle-col)] items-center justify-center rounded-md transition-colors data-[state=open]:text-sidebar-foreground shrink-0"
                    >
                      <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
                      <span className="sr-only">Toggle</span>
                    </button>
                  </CollapsibleTrigger>
                ) : (
                  <span
                    aria-hidden="true"
                    className="inline-flex h-8 w-[var(--menu-toggle-col)] items-center justify-center shrink-0"
                  />
                )}
                <SidebarMenuButton
                  tooltip={item.title}
                  onClick={() => handleItemClick(item.action)}
                  className="flex-1 min-w-0 cursor-pointer hover:bg-accent hover:text-accent-foreground"
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </div>
              {item.items?.length ? (
                <>
                  <CollapsibleContent>
                    <SidebarMenuSub className="ml-[calc(var(--menu-toggle-col)+var(--menu-gap)+var(--menu-sub-extra))] mr-2 px-2 py-1 translate-x-0">
                      {item.items?.map((subItem, subIndex) => {
                        const subItemId = getMenuItemId(subItem, subIndex)
                        const hasSubSubItems = Boolean(subItem.items?.length)
                        const subOpen = hasSubSubItems ? menuState[subItemId] ?? false : undefined
                        const handleSubOpenChange = (nextOpen: boolean) => {
                          if (!hasSubSubItems) return
                          toggleMenuSection({ id: subItemId, open: nextOpen })
                        }

                        return (
                          <Collapsible
                            key={subItemId}
                            asChild
                            {...(hasSubSubItems ? { open: subOpen, onOpenChange: handleSubOpenChange } : {})}
                          >
                            <SidebarMenuSubItem>
                              {hasSubSubItems ? (
                                <>
                                  <div className="flex items-center gap-1">
                                    <CollapsibleTrigger asChild>
                                      <button
                                        type="button"
                                        className="text-sidebar-foreground/70 hover:text-sidebar-foreground p-1"
                                      >
                                        <ChevronRight className="size-3 transition-transform data-[state=open]:rotate-90" />
                                      </button>
                                    </CollapsibleTrigger>
                                    <SidebarMenuSubButton
                                      onClick={() => handleItemClick(subItem.action)}
                                      className="cursor-pointer hover:bg-accent hover:text-accent-foreground flex-1"
                                    >
                                      <span>{subItem.title}</span>
                                    </SidebarMenuSubButton>
                                  </div>
                                  <CollapsibleContent>
                                    <SidebarMenuSub className="ml-4 mt-1">
                                      {subItem.items?.map((subSubItem) => (
                                        <SidebarMenuSubItem key={subSubItem.title}>
                                          <SidebarMenuSubButton
                                            onClick={() => handleItemClick(subSubItem.action)}
                                            className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                                          >
                                            <span>{subSubItem.title}</span>
                                          </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                      ))}
                                    </SidebarMenuSub>
                                  </CollapsibleContent>
                                </>
                              ) : (
                                <SidebarMenuSubButton
                                  onClick={() => handleItemClick(subItem.action)}
                                  className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                                >
                                  <span>{subItem.title}</span>
                                </SidebarMenuSubButton>
                              )}
                            </SidebarMenuSubItem>
                          </Collapsible>
                        )
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </>
              ) : null}
            </SidebarMenuItem>
          </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
