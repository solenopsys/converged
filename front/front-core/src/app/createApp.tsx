import { useEffect, useState, useRef } from "react";
import { createDomain } from "effector";
import {
  EventBusImpl,
  SlotProvider,
  addMenuRequested,
} from "../slots";
import { tabRegistered } from "sidebar-controller";

export interface AppConfig {
  name: string;
  modules: string[];
  layout?: "sidebar" | "dashboard" | "simple";
  layoutProps?: Record<string, any>;
  menu?: MenuItemConfig[];
  menuId?: string;
  ssrRootId?: string;
  mountChatView?: boolean;
  placeholderId?: string;
}

export type MenuItemConfig = {
  title?: string;
  action?: { id: string } | string;
  actionId?: string;
  targetId?: string;
  items?: MenuItemConfig[];
  [key: string]: any;
};

export type ModuleLoader = () => Promise<any>;

export interface CreateAppOptions {
  config: AppConfig;
  moduleLoaders: Record<string, ModuleLoader>;
}

/**
 * Creates the main App component based on configuration
 */
export function createApp({ config, moduleLoaders }: CreateAppOptions) {
  const domain = createDomain(`app-${config.name}`);
  const bus = new EventBusImpl(domain);

  // Expose bus globally for debugging
  if (typeof window !== "undefined") {
    (window as any).__BUS__ = bus;
  }

  const loadAndPlugModules = async () => {
    const plugins: Array<{ id: string; plugin: any; module: any }> = [];

    for (const id of config.modules) {
      const loader = moduleLoaders[id];
      if (!loader) {
        console.warn(`[App] Module loader not found for: ${id}`);
        continue;
      }

      try {
        const mod = await loader();
        const plugin = mod.default || mod;

        if (plugin && typeof plugin.plug === "function") {
          plugin.plug(bus);
          plugins.push({ id, plugin, module: mod });
          console.log(`[App] Plugin ${id} registered`);

          // Register module menu if exists
          if (mod.MENU) {
            addMenuRequested({
              microfrontendId: id,
              menu: [mod.MENU],
            });
          }

          // Register sidebar tabs if exist
          if (mod.SIDEBAR_TABS) {
            mod.SIDEBAR_TABS.forEach((tab: any) => {
              tabRegistered(tab);
            });
          }

          // Register dashboard widgets if exist
          if (mod.DASHBOARD_WIDGETS && Array.isArray(mod.DASHBOARD_WIDGETS)) {
            for (const actionId of mod.DASHBOARD_WIDGETS) {
              bus.run("dashboard.register_widget", { actionId });
            }
          }
        }
      } catch (err) {
        console.error(`[App] Failed to load module ${id}:`, err);
      }
    }

    console.log(`[App] Loaded ${plugins.length} plugins:`, plugins.map((p) => p.id));
    return plugins;
  };

  const registerScrollActions = (items: MenuItemConfig[]): MenuItemConfig[] => {
    return items.map((item) => {
      const nextItem: MenuItemConfig = { ...item };
      const targetId = item.targetId;

      if (targetId && !item.action) {
        const actionId = item.actionId ?? `scroll:${targetId}`;
        bus.register({
          id: actionId,
          description: `Scroll to ${targetId}`,
          invoke: () => {
            const target = document.getElementById(targetId);
            if (target) {
              target.scrollIntoView({ behavior: "smooth", block: "start" });
              history.replaceState(null, "", `#${targetId}`);
            }
          },
        });
        nextItem.action = { id: actionId };
      }

      if (Array.isArray(item.items)) {
        nextItem.items = registerScrollActions(item.items);
      }

      return nextItem;
    });
  };

  const mountSsrContent = (ssrRootId: string) => {
    const SsrCanvas = ({ rootId }: { rootId: string }) => {
      const containerRef = useRef<HTMLDivElement | null>(null);

      useEffect(() => {
        const source = document.getElementById(rootId);
        const container = containerRef.current;
        if (!source || !container) return;

        const placeholder = document.createElement("div");
        placeholder.style.display = "none";
        source.parentNode?.insertBefore(placeholder, source);
        container.appendChild(source);

        return () => {
          placeholder.parentNode?.insertBefore(source, placeholder);
          placeholder.remove();
        };
      }, [rootId]);

      return <div ref={containerRef} className="h-full w-full overflow-auto" />;
    };

    bus.present({
      widget: {
        view: SsrCanvas,
        placement: () => "center",
        commands: {},
        config: { rootId: ssrRootId },
      },
    });
  };

  // The App component
  function App() {
    const [isReady, setIsReady] = useState(false);
    const initialized = useRef(false);

    useEffect(() => {
      if (initialized.current) return;
      initialized.current = true;

      console.log(`[App] Initializing ${config.name}...`);
      loadAndPlugModules()
        .then(() => setIsReady(true))
        .catch((err) => console.error("[App] Failed to initialize:", err));
    }, []);

    useEffect(() => {
      if (!isReady) return;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Mount layout
          bus.run("layout.mount", {
            name: config.layout ?? "sidebar",
            props: config.layoutProps,
          });

          // Handle SSR content if present
          const ssrId = config.ssrRootId || "ssr-content";
          const ssrEl = document.getElementById(ssrId);
          if (ssrEl && ssrEl.innerHTML.trim().length > 0) {
            mountSsrContent(ssrId);
          }

          // Register custom menu if provided
          if (config.menu?.length) {
            const menu = registerScrollActions(config.menu);
            addMenuRequested({
              microfrontendId: config.menuId ?? "landing",
              menu,
            });
          }

          // Mount left menu
          bus.run("left.menu.mount", {});

          // Mount chat view if enabled
          if (config.mountChatView !== false) {
            bus.run("chats.view", { recordId: "default-chat" });
          }

          // Remove placeholder if specified
          if (config.placeholderId) {
            document.getElementById(config.placeholderId)?.remove();
          }
        });
      });
    }, [isReady]);

    if (!isReady) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
        </div>
      );
    }

    return <SlotProvider />;
  }

  return { App, bus };
}
