import * as React from "react"
import * as TablerIcons from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { useGlobalTranslation } from "@/hooks/global_i18n"
import { useMenu } from "@/hooks/menu"
import { registry } from "../controllers/registry";

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

export const MenuView = () => {
  const { i18n } = useGlobalTranslation("menu")

  const navMain = processItems(useMenu())
  console.log("navMain processed", navMain);
  const navSecondary = processItems(i18n.t("navSecondary", { ns: "menu", returnObjects: true }) || [])
  console.log("navSecondary", navSecondary);

  return (
    <>
      <NavMain items={navMain} onSelect={(actionId: string) => {
        console.log("ACTIONS", actionId);
        registry.run(actionId, {})
      }} />
      <NavSecondary items={navSecondary} className="mt-auto" />
    </>
  )
}