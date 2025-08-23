import  {MenuController}  from "../controllers/menu-controller";

import {MenuItem} from "../controllers/menu-controller";
// Экспортируем инстанс
const menuController = MenuController.getInstance();

// Хук для использования меню
import { useState, useEffect } from 'react';

export const useMenu = (): MenuItem[] => {
   console.log("useMenu---------------");

  const [menus, setMenus] = useState<MenuItem[]>(menuController.getAllMenus());
  
  useEffect(() => {
    const unsubscribe = menuController.subscribe(setMenus);
    return unsubscribe;
  }, []);
  
  return menus;
};