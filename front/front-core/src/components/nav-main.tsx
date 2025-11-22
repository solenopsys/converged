"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Action } from "../plugin/types_actions";
import { MenuItem } from "../controllers/menu-store";

const ChevronRightIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export function NavMain({
  items,
  onSelect,
}: {
  items: MenuItem[];
  onSelect?: (actionId: string) => void;
}) {
  console.log("NavMain inside", items);

  const handleItemClick = (action: Action<any, any>) => {
    console.log("handleItemClick", action);
    onSelect?.(action);
  };

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items?.map((item) => (
          <Collapsible key={item.title} defaultOpen={item.isActive}>
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
                  <CollapsibleTrigger className="text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0 after:absolute after:-inset-2 peer-data-[size=sm]/menu-button:top-1 peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 group-data-[collapsible=icon]:hidden data-[state=open]:rotate-90 cursor-pointer">
                    <ChevronRightIcon />
                    <span className="sr-only">Toggle</span>
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
  );
}
