import { Button } from "./ui/button"
import { Separator } from "./ui/separator"
import { SidebarTrigger } from "./ui/sidebar"
import { useGlobalTranslation } from "../hooks/global_i18n";
import React from "react";

export function SiteHeader() {
  const { t, i18n } = useGlobalTranslation("menu");

  // Теперь это работает без проверок! Хук сам все обрабатывает
  const menuData = i18n.getResource(i18n.language, 'menu', 'navMain');

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <img
          src="/header-logo-white.svg"
          alt="project-logo-dark"
          className="hidden h-8 w-auto dark:block"
          onError={(event) => { event.currentTarget.style.display = "none"; }}
        />
        <img
          src="/header-logo-black.svg"
          alt="project-logo-light"
          className="block h-8 w-auto dark:hidden"
          onError={(event) => { event.currentTarget.style.display = "none"; }}
        />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">
          {menuData?.navMain?.[0]?.title || t('default_title', 'Dashboard')}
        </h1>
      </div>
    </header>
  )
}
