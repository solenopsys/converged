
export interface MenuItem {
    id?: string;
    title?: string;
    path?: string;
    icon?: string;
    [key: string]: any;
  }
  
  export interface MenuData {
    id: string;
    items: MenuItem[];
  }
  
 export type MenuListener = (menus: MenuItem[]) => void;
  
  // Простой синглтон контроллер меню
  class MenuController {
    private static instance: MenuController | null = null;
    private menus: MenuData[] = [];
    private listeners: MenuListener[] = []; 
    
    
    constructor() {
      if (MenuController.instance) return MenuController.instance;
      MenuController.instance = this;
    }
    
    static getInstance(): MenuController {
      if (!MenuController.instance) {
        new MenuController();
      }
      return MenuController.instance!;
    }
    
    addMenu(microfrontendId: string, menu: MenuItem[]): void {
 
      // Убираем старое меню этого микрофронтенда
      this.menus = this.menus.filter(m => m.id !== microfrontendId);
      
      // Добавляем новое
      this.menus.push({
        id: microfrontendId,
        items: menu
      });
      
      console.log('Menu added:', microfrontendId, menu);
      this.notifyListeners();
    }

   
    
    getAllMenus(): MenuItem[] {
      // Просто склеиваем все меню в один массив
      console.log("getAllMenus-----------№№", this.menus);
      return this.menus.flatMap(m => m.items);
    }
    
    subscribe(callback: MenuListener): () => void {
      this.listeners.push(callback);
      return () => {
        this.listeners = this.listeners.filter(l => l !== callback);
      };
    }
    
    private notifyListeners(): void {
      this.listeners.forEach(callback => callback(this.getAllMenus()));
    }
  }


  export { MenuController};