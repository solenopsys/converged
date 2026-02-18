import { ComponentProps, CSSProperties, MouseEvent, ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useUnit } from "effector-react";
import { AppSidebar } from "./app-sidebar";
import { Button } from "./ui/button";
import { NavUser } from "./nav-user";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "./ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { chatInitRequested, chatSendRequested } from "../chat/events";
import { Slot } from "../slots";
import { useGlobalTranslation } from "../hooks/global_i18n";
import { getTablerIcon } from "../icons-shim";
import {
  $activeTab,
  $rightSidebarWidth,
  $sidebarTabs,
  sidebarWidthChanged,
  tabActivated,
  type SidebarTab,
} from "sidebar-controller";
import {
  Boxes,
  Filter,
  Mail,
  Menu,
  MessageSquare,
  PanelTop,
  Paperclip,
  Search,
  Send,
} from "lucide-react";

const TAB_ICON_CLASS = "shrink-0";
const TAB_ICON_STYLE = { width: "var(--icon-size)", height: "var(--icon-size)" } as CSSProperties;
const PINNED_TABS = [
  { id: "dashboard", icon: PanelTop },
  { id: "filter", icon: Filter },
  { id: "search", icon: Search },
  { id: "mail", icon: Mail },
  { id: "dag", icon: Boxes },
] as const;
const PINNED_TAB_IDS = new Set(PINNED_TABS.map((tab) => tab.id));

const SidebarTabsTrigger = ({
  onClick,
  ...props
}: ComponentProps<typeof TabsTrigger>) => {
  const { isMobile, openMobile, setOpenMobile, open, setOpen } = useSidebar("right");

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!open) {
      setOpen(true);
    }
    if (isMobile && !openMobile) {
      setOpenMobile(true);
    }
  };

  return <TabsTrigger {...props} onClick={handleClick} />;
};

const ChatActionButtons = ({
  inputValue,
  handleAttachClick,
  handleSend,
  tabTriggerClass,
}: {
  inputValue: string;
  handleAttachClick: () => void;
  handleSend: () => void;
  tabTriggerClass: string;
}) => {
  const { state } = useSidebar("right");
  const isExpanded = state === "expanded";

  return (
    <div className="mt-auto flex flex-col">
      {isExpanded ? (
        <>
          <Button
            onClick={handleAttachClick}
            size="icon"
            variant="ghost"
            className={tabTriggerClass}
            aria-label="Attach file"
          >
            <Paperclip className={TAB_ICON_CLASS} style={TAB_ICON_STYLE} />
          </Button>
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            size="icon"
            variant="ghost"
            className={tabTriggerClass}
            aria-label="Send"
          >
            <Send className={TAB_ICON_CLASS} style={TAB_ICON_STYLE} />
          </Button>
        </>
      ) : (
        <SidebarTabsTrigger value="chat" className={tabTriggerClass}>
          <MessageSquare className={TAB_ICON_CLASS} style={TAB_ICON_STYLE} />
        </SidebarTabsTrigger>
      )}
    </div>
  );
};

const SidebarHeader = ({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) => {
  const { state: rightSidebarState } = useSidebar("right");

  return (
    <div className="flex h-(--pane-h) shrink-0 items-center justify-between border-b px-4">
      {rightSidebarState === "expanded" && (
        <SidebarTrigger side="right" className="h-(--pane-h) w-(--pane-h)" />
      )}
      <div className="flex items-center gap-2 ml-auto">
        <NavUser user={user} />
      </div>
    </div>
  );
};

export type SidebarLayoutUser = {
  name: string;
  email: string;
  avatar: string;
};

export type SidebarLayoutProps = {
  children?: ReactNode;
  basePath?: string;
  user?: SidebarLayoutUser;
  attachments?: ReactNode;
  onFilesSelected?: (files: File[]) => void;
  inputPlaceholder?: string;
};

export const SidebarLayout = ({
  children,
  basePath = "sidebar",
  user,
  attachments,
  onFilesSelected,
  inputPlaceholder = "Напишите сообщение...",
}: SidebarLayoutProps) => {
  const { i18n } = useGlobalTranslation("menu");
  const translatedUser = i18n.t("user", { ns: "menu", returnObjects: true }) || {};
  const resolvedUser = user ?? (translatedUser as SidebarLayoutUser);

  const [activeTab, setActiveTab] = useUnit([$activeTab, tabActivated]);
  const sidebarTabs = useUnit($sidebarTabs);
  const rightSidebarWidth = useUnit($rightSidebarWidth);
  const setRightSidebarWidth = (width: number) => sidebarWidthChanged({ side: "right", width });
  const [inputValue, setInputValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const tabTriggerClass =
    "!border-0 !flex-none !h-(--pane-h) !w-(--pane-h) items-center justify-center rounded-none !p-0 !text-sidebar-foreground/60 hover:!text-sidebar-foreground data-[state=active]:!bg-transparent data-[state=active]:!text-sidebar-primary data-[state=active]:!shadow-none";

  const pinnedTabs = useMemo(() => {
    return PINNED_TABS.map((tab) => {
      const IconComponent = tab.icon;
      return {
        ...tab,
        icon: <IconComponent className={TAB_ICON_CLASS} style={TAB_ICON_STYLE} />,
      };
    });
  }, []);

  const dynamicTabs = useMemo(() => {
    return sidebarTabs
      .filter((tab) => !PINNED_TAB_IDS.has(tab.id))
      .map((tab: SidebarTab) => {
        const IconComponent = tab.iconName ? getTablerIcon(tab.iconName) : null;
        return {
          ...tab,
          icon: IconComponent ? (
            <IconComponent className={TAB_ICON_CLASS} style={TAB_ICON_STYLE} />
          ) : null,
        };
      });
  }, [sidebarTabs]);

  const activeTabValue = useMemo(() => {
    const allIds = new Set([
      "menu",
      "chat",
      ...pinnedTabs.map((tab) => tab.id),
      ...dynamicTabs.map((tab) => tab.id),
    ]);
    return allIds.has(activeTab) ? activeTab : "menu";
  }, [activeTab, dynamicTabs, pinnedTabs]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setActiveTab("chat");
    chatSendRequested(trimmed);
    setInputValue("");
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length > 0) {
      onFilesSelected?.(files);
    }
    event.currentTarget.value = "";
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (activeTab === "chat") {
      chatInitRequested();
      const checkAndMountChat = async () => {
        try {
          const bus = (window as any).__BUS__;
          if (bus && bus.run) {
            bus.run("chats.show", {});
          }
        } catch {
          // Ignore mount errors.
        }
      };
      checkAndMountChat();
    }
  }, [activeTab]);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SidebarProvider
        style={
          {
            height: "100svh",
            minHeight: 0,
            "--sidebar-width": `${rightSidebarWidth}px`,
            "--pitch": "4px",
            "--pane-h": "calc(var(--pitch) * 12)",
            "--pane-h-2": "calc(var(--pane-h) * 2)",
            "--pane-h-3": "calc(var(--pane-h) * 3)",
            "--icon-size": "calc(var(--pitch) * 4)",
          } as CSSProperties
        }
        className="h-svh !min-h-0"
        defaultOpenRight={true}
      >
        <SidebarInset>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-auto">
              <Slot id={`${basePath}:center`} preserveContent={true} />
            </div>
          </div>
        </SidebarInset>
        <AppSidebar
          basePath={basePath}
          side="right"
          width={rightSidebarWidth}
          minWidth={320}
          maxWidth={680}
          resizable
          onWidthChange={setRightSidebarWidth}
          collapsible="icon"
        >
          <Tabs
            value={activeTabValue}
            onValueChange={setActiveTab}
            className="relative flex h-full w-full overflow-hidden"
          >
            <div className="absolute right-0 top-0 z-10 flex h-full w-(--pane-h) flex-col border-l border-sidebar-border bg-sidebar">
              <TabsList className="flex h-full w-full flex-col items-center justify-start rounded-none bg-transparent !p-0 text-sidebar-foreground/60">
                <div className="flex flex-col">
                  <SidebarTabsTrigger value="menu" className={tabTriggerClass}>
                    <Menu className={TAB_ICON_CLASS} style={TAB_ICON_STYLE} />
                  </SidebarTabsTrigger>
                  {pinnedTabs.map((tab) => (
                    <SidebarTabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className={tabTriggerClass}
                    >
                      {tab.icon}
                    </SidebarTabsTrigger>
                  ))}
                  {dynamicTabs.map((tab) => (
                    <SidebarTabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className={tabTriggerClass}
                    >
                      {tab.icon}
                    </SidebarTabsTrigger>
                  ))}
                </div>
                <ChatActionButtons
                  inputValue={inputValue}
                  handleAttachClick={handleAttachClick}
                  handleSend={handleSend}
                  tabTriggerClass={tabTriggerClass}
                />
              </TabsList>
            </div>
            <div className="flex min-h-0 w-full flex-1 flex-col pr-(--pane-h)">
              <SidebarHeader user={resolvedUser} />
              <div className="min-h-0 flex-1">
                {pinnedTabs.map((tab) => (
                  <TabsContent
                    key={tab.id}
                    value={tab.id}
                    forceMount
                    className="h-full overflow-auto data-[state=inactive]:hidden"
                  >
                    <Slot id={`${basePath}:tab:${tab.id}`} preserveContent={true} />
                  </TabsContent>
                ))}
                <TabsContent
                  value="menu"
                  forceMount
                  className="h-full overflow-auto data-[state=inactive]:hidden"
                >
                  <Slot id={`${basePath}:left`} preserveContent={true} />
                </TabsContent>
                <TabsContent
                  value="chat"
                  forceMount
                  className="h-full overflow-auto data-[state=inactive]:hidden"
                >
                  <Slot id={`${basePath}:right`} preserveContent={true} />
                </TabsContent>
                {dynamicTabs.map((tab) => (
                  <TabsContent
                    key={tab.id}
                    value={tab.id}
                    forceMount
                    className="h-full overflow-auto data-[state=inactive]:hidden"
                  >
                    <Slot id={`${basePath}:tab:${tab.id}`} preserveContent={true} />
                  </TabsContent>
                ))}
              </div>
              <div className="h-(--pane-h-2) flex gap-2 border-t bg-input/30 px-2 relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                {attachments ? (
                  <div className="absolute bottom-full left-0 right-0 mb-2 px-2 z-50">
                    {attachments}
                  </div>
                ) : null}
                <textarea
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={inputPlaceholder}
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    boxShadow: "none",
                    paddingTop: "8px",
                    paddingBottom: 0,
                    paddingLeft: 0,
                    paddingRight: 0,
                    margin: 0,
                  }}
                  className="flex-1 resize-none text-sm"
                  aria-label="Message"
                />
              </div>
            </div>
          </Tabs>
        </AppSidebar>
        {children}
      </SidebarProvider>
    </Suspense>
  );
};
