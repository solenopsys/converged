import type { ComponentType } from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useUnit } from "effector-react";
import { $activeTab, tabActivated } from "sidebar-controller";
import type {
  ChatActionKind,
  ChatQuickKind,
  HeaderIconKind,
  PanelConfig,
} from "./panelTypes";
import type { MenuItem } from "../../controllers/menu-store";
import { $allMenuItems } from "../../controllers/menu-store";
import { registry } from "../../controllers/registry";
import { useGlobalTranslation } from "../../hooks/global_i18n";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { SidebarProvider } from "../ui/sidebar";
import { NavMain } from "../nav-main";
import { chatInitRequested, chatSendRequested } from "../../chat/events";
import {
  Columns2,
  LayoutGrid,
  LogIn,
  LogOut,
  Maximize2,
  MessageCircle,
  Mic,
  Minimize2,
  Moon,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  Plus,
  Share2,
  Settings,
  Sparkles,
  Sun,
  Zap,
  Brain,
  BarChart3,
  Briefcase,
  FileText,
  Database,
  Users,
  GitBranch,
  Activity,
  Webhook,
  Calendar,
  FolderOpen,
  HardDrive,
  Globe,
  Target,
} from "lucide-react";
import type { ChatState } from "assistant-state";
import { $fileListItems, fileSelected } from "files-state";
import type { FileListItem } from "files-state";

type ChatRuntime = {
  ChatDetail: ComponentType<{
    messages: ChatState["messages"];
    isLoading: boolean;
    currentResponse: string;
    send: (content: string) => void;
    onFilesSelected?: (files: File[]) => void;
    files?: FileListItem[];
    showComposer?: boolean;
    intro?: React.ReactNode;
  }>;
  chatStore: {
    $chat: any;
  };
};

function useThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored || (prefersDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return { theme, mounted, toggleTheme };
}

type TabsConfig = PanelConfig["tabs"];
type ChatConfig = PanelConfig["chat"];

type PanelClick = {
  onClick?: () => void;
};

type CollapseControl = {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

type ParallelControl = {
  parallel?: boolean;
  onToggleParallel?: () => void;
};

type ConstrainControl = {
  constrained?: boolean;
  onToggleConstrain?: () => void;
};

const headerIconMap: Record<HeaderIconKind, typeof LayoutGrid> = {
  grid: LayoutGrid,
  pin: Pin,
  more: MoreHorizontal,
};

const chatActionMap: Record<ChatActionKind, typeof LayoutGrid> = {
  add: Plus,
  mic: Mic,
  spark: Sparkles,
};

const quickIconMap: Record<ChatQuickKind, typeof LayoutGrid> = {
  message: MessageCircle,
  spark: Sparkles,
  bolt: Zap,
};

const menuIconMap: Record<string, any> = {
  // lucide стандартные
  grid: LayoutGrid,
  nodes: Share2,
  chat: MessageCircle,
  settings: Settings,
  // Группы (lucide)
  IconBrain: Brain,
  IconChartBar: BarChart3,
  IconBriefcase: Briefcase,
  IconFileText: FileText,
  IconDatabase: Database,
  IconUsers: Users,
  IconGitBranch: GitBranch,
  IconActivity: Activity,
  IconWebhook: Webhook,
  IconCalendar: Calendar,
  IconFolder: FolderOpen,
  IconServer: HardDrive,
  IconGlobe: Globe,
  IconTarget: Target,
};

const getIcon = (iconName?: string) => {
  if (!iconName) return undefined;
  return menuIconMap[iconName];
};

const resolveMenuItems = (items: MenuItem[], t?: (key: string) => string): MenuItem[] => {
  return items.map((item) => {
    const iconName = (item as { iconName?: string }).iconName;
    const Icon = getIcon(iconName);

    // Переводим title если есть функция перевода и title похож на ключ
    let title = item.title;
    if (t && title && title.includes('.')) {
      const translated = t(title);
      title = translated !== title ? translated : title.split('.').pop() || title;
    }

    const resolved: MenuItem = {
      ...item,
      title,
      icon: item.icon ?? (Icon ? <Icon className="panel-icon" size={16} /> : undefined),
    };
    if (item.items && Array.isArray(item.items)) {
      resolved.items = resolveMenuItems(item.items as MenuItem[], t);
    }
    return resolved;
  });
};

function HeaderIcon({ kind }: { kind: HeaderIconKind }) {
  const Icon = headerIconMap[kind];
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="panel-icon-button header-icon-button"
      aria-label={`${kind} control`}
    >
      <Icon className="panel-icon" />
    </Button>
  );
}

function CollapseButton({ collapsed, onToggleCollapse }: CollapseControl) {
  if (!onToggleCollapse) {
    return null;
  }
  const Icon = collapsed ? PanelRightOpen : PanelRightClose;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`panel-icon-button panel-control-button panel-control-collapse${
        collapsed ? " is-collapsed" : ""
      }`}
      aria-label={collapsed ? "Expand panels" : "Collapse panels"}
      aria-pressed={collapsed}
      onClick={(event) => {
        event.stopPropagation();
        onToggleCollapse();
      }}
    >
      <Icon className="panel-icon" />
    </Button>
  );
}

function ParallelButton({ parallel, onToggleParallel }: ParallelControl) {
  if (!onToggleParallel) {
    return null;
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`panel-icon-button panel-control-button panel-control-parallel${
        parallel ? " is-parallel" : ""
      }`}
      aria-label={parallel ? "Exit parallel panels" : "Parallel panels"}
      aria-pressed={parallel}
      onClick={(event) => {
        event.stopPropagation();
        onToggleParallel();
      }}
    >
      <Columns2 className="panel-icon" />
    </Button>
  );
}

function ConstrainButton({ constrained, onToggleConstrain }: ConstrainControl) {
  if (!onToggleConstrain) {
    return null;
  }
  const Icon = constrained ? Maximize2 : Minimize2;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`panel-icon-button panel-control-button panel-control-constrain${
        constrained ? " is-constrained" : ""
      }`}
      aria-label={constrained ? "Use full width" : "Limit width"}
      aria-pressed={constrained}
      onClick={(event) => {
        event.stopPropagation();
        onToggleConstrain();
      }}
    >
      <Icon className="panel-icon" />
    </Button>
  );
}

function ThemeButton() {
  const { theme, mounted, toggleTheme } = useThemeToggle();

  if (!mounted) return null;

  const Icon = theme === "light" ? Moon : Sun;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="panel-icon-button panel-control-button panel-control-theme"
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      onClick={(event) => {
        event.stopPropagation();
        toggleTheme();
      }}
    >
      <Icon className="panel-icon" />
    </Button>
  );
}

function LoginButton() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const syncAuth = () => {
      setIsAuthenticated(Boolean(window.localStorage.getItem("authToken")));
    };
    syncAuth();
    window.addEventListener("auth-token-changed", syncAuth);
    window.addEventListener("storage", syncAuth);
    return () => {
      window.removeEventListener("auth-token-changed", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  const openAuthPanel = useCallback(() => {
    tabActivated("auth");

    const runShowLogin = () => {
      const action = registry.get("show_login");
      if (!action) return false;
      try {
        registry.run("show_login", {});
      } catch (error) {
        console.error("[RightRail] Failed to run show_login", error);
      }
      return true;
    };

    if (runShowLogin()) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (runShowLogin() || attempts >= 60) {
        window.clearInterval(timer);
      }
    }, 100);
  }, []);

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem("authToken");
    window.dispatchEvent(new Event("auth-token-changed"));
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="panel-icon-button panel-control-button panel-control-login"
      aria-label={isAuthenticated ? "Log out" : "Open login"}
      onClick={(event) => {
        event.stopPropagation();
        if (isAuthenticated) {
          handleLogout();
        } else {
          openAuthPanel();
        }
      }}
    >
      {isAuthenticated ? (
        <LogOut className="panel-icon" />
      ) : (
        <LogIn className="panel-icon" />
      )}
    </Button>
  );
}

function PanelHeader({
  icons,
  collapsed,
  onToggleCollapse,
  parallel,
  onToggleParallel,
  constrained,
      onToggleConstrain,
}: {
  icons: HeaderIconKind[];
} & CollapseControl &
  ParallelControl &
  ConstrainControl) {
  return (
    <div className="panel-header">
      <div className="panel-brand">
        <img src="/logo-white.svg" alt="Logo" className="panel-logo panel-logo-dark" />
        <img src="/logo-black.svg" alt="Logo" className="panel-logo panel-logo-light" />
      </div>
      <div className="header-right">
        <div className="header-icons">
          {icons.map((icon) => (
            <HeaderIcon key={icon} kind={icon} />
          ))}
        </div>
        <LoginButton />
        <ThemeButton />
        <ParallelButton parallel={parallel} onToggleParallel={onToggleParallel} />
        <ConstrainButton constrained={constrained} onToggleConstrain={onToggleConstrain} />
        <CollapseButton collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      </div>
    </div>
  );
}

export function TabsPanel({
  headerIcons,
  menuItems,
  onClick,
  collapsed,
  onToggleCollapse,
  parallel,
  onToggleParallel,
  constrained,
  onToggleConstrain,
}: TabsConfig & PanelClick & CollapseControl & ParallelControl & ConstrainControl) {
  // Используем динамические меню из store, fallback на статические из конфига
  const dynamicMenuItems = useUnit($allMenuItems);
  const items = dynamicMenuItems.length > 0 ? dynamicMenuItems : menuItems;

  // Активная вкладка
  const activeTab = useUnit($activeTab);
  const showMenu = !activeTab || activeTab === "menu";

  // Локализация для меню микрофронтендов
  const { t } = useGlobalTranslation("mf-menu");

  const handleMenuSelect = useCallback((actionId: string) => {
    console.log("[TabsPanel] Menu selected:", actionId);
    registry.run(actionId, {});
  }, []);

  const handleBackToMenu = useCallback(() => {
    tabActivated("menu");
  }, []);

  return (
    <div className="panel tabs-panel" onClick={onClick}>
      <div className="panel-content">
        <PanelHeader
          icons={headerIcons}
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
          parallel={parallel}
          onToggleParallel={onToggleParallel}
          constrained={constrained}
          onToggleConstrain={onToggleConstrain}
        />
        <Separator className="panel-separator panel-separator-tight" />
        <div className="tabs-body">
          <div className="panel-menu-wrapper" style={{ display: showMenu ? 'block' : 'none' }}>
            <SidebarProvider className="panel-menu-provider" defaultOpen>
              <div className="panel-menu">
                <NavMain items={resolveMenuItems(items, t)} onSelect={handleMenuSelect} />
              </div>
            </SidebarProvider>
          </div>
          <div className="panel-tab-content" style={{ display: showMenu ? 'none' : 'flex' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToMenu}
              className="mb-2"
            >
              ← Back to menu
            </Button>
            <div id="slot-panel-tab" className="panel-tab-slot" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBody({
  title,
  description,
  quickCommands,
  onQuickCommand,
  inline = false,
}: {
  title: string;
  description?: string;
  quickCommands?: { label: string; icon?: ChatQuickKind }[];
  onQuickCommand?: (command: { label: string; icon?: ChatQuickKind }) => void;
  inline?: boolean;
}) {
  const body = (
    <div className="chat-body">
      <div className="chat-body-title">{title}</div>
      {description ? <div className="chat-body-subtitle">{description}</div> : null}
      <ChatQuickCommands commands={quickCommands} onCommand={onQuickCommand} />
    </div>
  );

  if (inline) {
    return body;
  }

  return (
    <div className="chat-body-wrapper">
      {body}
    </div>
  );
}

function ChatQuickCommands({
  commands,
  onCommand,
}: {
  commands?: { label: string; icon?: ChatQuickKind }[];
  onCommand?: (command: { label: string; icon?: ChatQuickKind }) => void;
}) {
  if (!commands?.length) {
    return null;
  }
  return (
    <div className="chat-quick">
      {commands.map((command, index) => {
        const Icon = command.icon ? quickIconMap[command.icon] : null;
        return (
          <Button
            key={`${command.label}-${index}`}
            type="button"
            variant="outline"
            size="sm"
            className="chat-quick-button"
            onClick={() => onCommand?.(command)}
          >
            {Icon ? <Icon className="panel-icon" /> : null}
            <span>{command.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

function ChatInput({
  label,
  actions,
}: {
  label: string;
  actions: ChatActionKind[];
}) {
  return (
    <div className="chat-input">
      <span>{label}</span>
      <div className="chat-input-actions">
        {actions.map((icon, index) => {
          const Icon = chatActionMap[icon];
          return (
            <Button
              key={`${icon}-${index}`}
              type="button"
              variant="ghost"
              size="icon"
              className="panel-icon-button panel-action-button"
              aria-label={`${icon} action`}
              onClick={(event) => event.stopPropagation()}
            >
              <Icon className="panel-icon" />
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function ChatRuntimePanel({
  runtime,
  title,
  description,
  quickCommands,
  fileItems,
}: {
  runtime: ChatRuntime;
  title: string;
  description?: string;
  quickCommands?: { label: string; icon?: ChatQuickKind }[];
  fileItems: FileListItem[];
}) {
  const { messages, isLoading, currentResponse } = useUnit(runtime.chatStore.$chat) as ChatState;
  const showIntro = messages.length === 0 && !isLoading && !currentResponse;
  const ChatDetail = runtime.ChatDetail;

  const handleQuickCommand = useCallback(
    (command: { label: string; icon?: ChatQuickKind }) => {
      if (isLoading) return;
      chatSendRequested(command.label);
    },
    [isLoading, chatSendRequested],
  );

  const handleFilesSelected = useCallback((files: File[]) => {
    if (!files.length) return;
    files.forEach((file) => fileSelected(file));
  }, [fileSelected]);

  return (
    <>
      <div className="chat-panel-runtime">
        <ChatDetail
          messages={messages}
          isLoading={isLoading}
          currentResponse={currentResponse}
          send={chatSendRequested}
          onFilesSelected={handleFilesSelected}
          files={fileItems}
          showComposer={true}
          intro={
            showIntro ? (
              <ChatBody
                title={title}
                description={description}
                quickCommands={quickCommands}
                onQuickCommand={handleQuickCommand}
                inline
              />
            ) : null
          }
        />
      </div>
    </>
  );
}

export function ChatPanel({
  onClick,
  title,
  description,
  quickCommands,
}: ChatConfig & PanelClick) {
  const fileItems = useUnit($fileListItems);
  const [chatRuntime, setChatRuntime] = useState<ChatRuntime | null>(null);

  useEffect(() => {
    let active = true;
    const loadChatRuntime = async () => {
      try {
        const runtime = await import(/* @vite-ignore */ "/mf/mf-assistants.js");
        if (!active) return;
        setChatRuntime({
          ChatDetail: runtime.ChatDetail,
          chatStore: runtime.chatStore,
        });
        chatInitRequested();
      } catch (error) {
        console.error("[ChatPanel] Failed to load chat runtime", error);
      }
    };
    loadChatRuntime();
    return () => {
      active = false;
    };
  }, [chatInitRequested]);

  return (
    <div className="panel chat-panel" onClick={onClick}>
      <div className="panel-content chat-panel-content">
        {chatRuntime ? (
          <ChatRuntimePanel
            runtime={chatRuntime}
            title={title}
            description={description}
            quickCommands={quickCommands}
            fileItems={fileItems}
          />
        ) : (
          <ChatBody
            title={title}
            description={description}
            quickCommands={quickCommands}
          />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="panel-icon-button panel-action-button panel-chat-button"
          aria-label="Open chat"
        >
          <MessageCircle className="panel-icon" />
        </Button>
      </div>
    </div>
  );
}
