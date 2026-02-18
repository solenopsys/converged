

// MenuView.tsx
import * as React from "react"
import * as TablerIcons from "@tabler/icons-react"
import { useUnit } from 'effector-react'

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { useSidebar } from "@/components/ui/sidebar"
import { $activeTab } from "sidebar-controller"
import { useGlobalTranslation } from "@/hooks/global_i18n"
import { $allMenuItems } from '../controllers/menu-store'

const renderIcon = (iconName: string) => {
  if (TablerIcons[iconName]) {
    const IconComponent = TablerIcons[iconName]
    return React.createElement(IconComponent)
  }
  return null
}

const processItems = (items: any[], t?: (key: string) => string) => {
  if (!Array.isArray(items)) return []

  return items.map(item => {
    const processedItem = { ...item }

    // Переводим title если есть функция перевода
    if (t && processedItem.title) {
      processedItem.title = t(processedItem.title)
    }

    if (processedItem.iconName) {
      processedItem.icon = renderIcon(processedItem.iconName)
      delete processedItem.iconName
    }

    if (processedItem.items && processedItem.items.length > 0) {
      processedItem.items = processItems(processedItem.items, t)
    }

    return processedItem
  })
}

export const MenuView = (params:{onClick: (actionId: string) => void}) => {
  const { t, i18n } = useGlobalTranslation("menu")
  const { isMobile, setOpenMobile } = useSidebar("left")

  // Используем стор напрямую вместо хука
  const menuItems = useUnit($allMenuItems)

  // Функция перевода для пунктов меню
  const translateTitle = (key: string) => {
    // key типа "menu.mailing" -> ищем в menu.json по ключу "menu.mailing"
    const translated = t(key)
    return translated !== key ? translated : key.split('.').pop() || key
  }

  const navMain = processItems(menuItems, translateTitle)
  console.log("navMain processed", navMain);

  const navSecondary = processItems(i18n.t("navSecondary", { ns: "menu", returnObjects: true }) || [])
  console.log("navSecondary", navSecondary);

  const handleSelect = (actionId: string) => {
    const beforeTab = $activeTab.getState();
    console.log("ACTIONS", actionId);
    params.onClick(actionId);
    if (isMobile) {
      requestAnimationFrame(() => {
        const afterTab = $activeTab.getState();
        if (afterTab === beforeTab || afterTab === "menu") {
          setOpenMobile(false);
        }
      });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <NavMain items={navMain} onSelect={(actionId: string) => {
        handleSelect(actionId);
      }} />
      <NavSecondary items={navSecondary} className="mt-auto" />
    </div>
  )
}

// Пример использования вместо menuController.addMenu():
// addMenu({ microfrontendId: 'some-id', menu: menuItems });
