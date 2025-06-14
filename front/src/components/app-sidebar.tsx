import * as React from "react"
import * as TablerIcons from "@tabler/icons-react"
import { useTranslation } from "react-i18next" // Импортируем хук для переводов

import { NavDocuments } from "@/components/nav-documents"
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

// Функция для рендеринга иконки по её имени
const renderIcon = (iconName) => {
  // Проверяем, существует ли такая иконка в TablerIcons
  if (TablerIcons[iconName]) {
    const IconComponent = TablerIcons[iconName];
    return <IconComponent />; // Используем JSX синтаксис вместо React.createElement
  }
  console.warn(`Icon ${iconName} not found`);
  return null;
};

// Функция для преобразования данных - заменяет строковые имена иконок на компоненты
const processData = (data) => {
  if (!data) return {}; // Защита от undefined data
  
  const processItems = (items) => {
    if (!items || !Array.isArray(items)) return [];
    
    return items.map(item => {
      const processedItem = { ...item };
      
      // Преобразуем iconName в компонент icon, если есть
      if (processedItem.iconName) {
        processedItem.icon = renderIcon(processedItem.iconName);
        delete processedItem.iconName;
      }
      
      // Рекурсивно обрабатываем вложенные элементы, если они есть
      if (processedItem.items && processedItem.items.length > 0) {
        processedItem.items = processItems(processedItem.items);
      }
      
      return processedItem;
    });
  };
  
  // Создаем глубокую копию данных
  const processedData = { ...data };
  
  // Обрабатываем все коллекции элементов
  if (processedData.navMain) {
    processedData.navMain = processItems(processedData.navMain);
  }
  
  if (processedData.navClouds) {
    processedData.navClouds = processItems(processedData.navClouds);
  }
  
  if (processedData.navSecondary) {
    processedData.navSecondary = processItems(processedData.navSecondary);
  }
  
  if (processedData.documents) {
    processedData.documents = processItems(processedData.documents);
  }
  
  return processedData;
};

export function AppSidebar({ ...props }) {
  // Используем namespace "menu" для получения переводов
  const { i18n } = useTranslation("menu");
  const [menuData, setMenuData] = React.useState(null);
  
  // Загружаем данные меню при монтировании компонента
  React.useEffect(() => {
    // Безопасное получение данных
    const getMenuData = () => {
      try {
        if (i18n.options && i18n.options.resources) {
          const lang = i18n.language || 'en';
          if (i18n.options.resources[lang] && i18n.options.resources[lang].menu) {
            return i18n.options.resources[lang].menu;
          }
        }
        return {};
      } catch (error) {
        console.error('Ошибка при получении данных меню:', error);
        return {};
      }
    };
    
    // Получаем данные из i18n и обрабатываем их
    const rawData = getMenuData();
    console.log("Raw menu data:", rawData);
    const processed = processData(rawData);
    console.log("Processed menu data:", processed);
    setMenuData(processed);
  }, [i18n.language]); // Обновляем при изменении языка
  
  // Если данные еще не загружены, показываем загрузку
  if (!menuData) {
    return <div>Loading...</div>;
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <img src="/logo.svg" alt="logo" className="!h-6 !w-auto" />
                <span className="text-small font-semibold">CONVERGED</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={menuData.navMain || []} />
        {/* <NavDocuments items={menuData.documents || []} /> */}
        <NavSecondary items={menuData.navSecondary || []} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={menuData.user || {}} />
      </SidebarFooter>
    </Sidebar>
  )
}