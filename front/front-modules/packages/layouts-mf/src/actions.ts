import { SimpleLayout } from "./components/SimpleLayout";
import { SidebarLayout } from "./components/SidebarLayout";
import { DashboardLayout } from "./components/DashboardLayout";
import { Widget, Action, present } from "converged-core";

export const SimpleLayoutWidget: Widget<typeof SimpleLayout> = {
  view: SimpleLayout,
  placement: (ctx) => "full",
  config: {},
  mount: () => { },
  bindings: {},
};

export const SidebarLayoutWidget: Widget<typeof SidebarLayout> = {
  view: SidebarLayout,
  placement: (ctx) => "full",
  config: {},
  mount: () => { },
  bindings: {},
};

export const DashboardLayoutWidget: Widget<typeof DashboardLayout> = {
  view: DashboardLayout,
  placement: (ctx) => "center",
  config: {},
  mount: () => { },
  bindings: {},
};

const LAYOUTS = [SimpleLayoutWidget, SidebarLayoutWidget, DashboardLayoutWidget];

export const LayoutMountAction: Action = {
  id: "layout.mount",
  description: "Монтирование layout",
  invoke: (widget: Widget, context: any) => {
    const slot = widget.placement(context)
    present(widget);
  }
}

export const MenuAdd: Action = {
  id: "menu.add",
  description: "Добавление пунктов меню",
  invoke: (menu: any, context: any) => {
     
  }
}


export const LayoutListAction: Action = {
  id: "layout.list",
  description: "Список layout",
  invoke: (widget: Widget, context: any) => {
    return LAYOUTS
  }
}

 

export const ACTIONS= [
  LayoutMountAction,
  LayoutListAction,
  MenuAdd
]


