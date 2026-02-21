"use client"

import { useEffect } from "react"
import { useUnit } from "effector-react"
import {
  $menuSectionsState,
  menuSectionToggled,
  controllerInitialized,
} from "sidebar-controller"
import { MenuItem } from "../controllers/menu-store"
import { NavMainShell, type MenuItemData } from "./shell/NavMainShell"

const menuItemToMenuItemData = (item: MenuItem): MenuItemData => ({
  key: item.key
    || (typeof item.action === "string" ? item.action : item.action?.id)
    || item.title,
  title: item.title || "",
  icon: item.icon,
  items: item.items?.map(menuItemToMenuItemData),
})

export function NavMain({
  items,
  onSelect,
}: {
  items: MenuItem[]
  onSelect?: (actionId: string) => void
}) {
  console.log("NavMain inside", items)

  const [menuState, initController, toggleMenuSection] = useUnit([
    $menuSectionsState,
    controllerInitialized,
    menuSectionToggled,
  ])

  useEffect(() => {
    initController()
  }, [initController])

  const menuItems = items?.map(menuItemToMenuItemData) ?? []
  const openSections = Object.entries(menuState)
    .filter(([, open]) => open)
    .map(([id]) => id)

  return (
    <NavMainShell
      items={menuItems}
      openSections={openSections}
      onSectionToggle={(key, open) => toggleMenuSection({ id: key, open })}
      onItemClick={(item) => {
        if (item.key) onSelect?.(item.key)
      }}
    />
  )
}
