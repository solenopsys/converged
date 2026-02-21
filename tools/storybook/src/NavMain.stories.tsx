import type { Meta } from "@storybook/react-vite";
import { useState } from "react";
import { NavMainShell, type MenuItemData } from "front-core";
import {
  Bot,
  BarChart2,
  BriefcaseBusiness,
  FileText,
  Database,
  Users,
  GitBranch,
  LogOut,
  Sun,
  Columns2,
} from "lucide-react";

const meta: Meta = {
  title: "Components/NavMain",
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        className="bg-sidebar text-sidebar-foreground border-sidebar-border rounded-sm border"
        style={{ width: 360, minHeight: 720, padding: 8 }}
      >
        <div className="border-sidebar-border mb-2 flex h-[52px] items-center justify-between border-b px-3">
          <div className="text-sm font-semibold tracking-wide">CONVERGED AI</div>
          <div className="flex items-center gap-3">
            <LogOut size={16} />
            <Sun size={16} />
            <Columns2 size={16} />
          </div>
        </div>
        <Story />
      </div>
    ),
  ],
};

export default meta;

const menuItems: MenuItemData[] = [
  { title: "AI", icon: <Bot size={16} /> },
  {
    title: "Analytics",
    icon: <BarChart2 size={16} />,
    items: [
      {
        title: "Telemetry",
        items: [{ title: "Hot" }, { title: "Cold" }],
      },
      {
        title: "Logs",
        items: [{ title: "Hot" }, { title: "Cold" }],
      },
      { title: "Usage" },
      { title: "dashboard" },
    ],
  },
  { title: "Business", icon: <BriefcaseBusiness size={16} /> },
  { title: "Content", icon: <FileText size={16} /> },
  { title: "Data", icon: <Database size={16} /> },
  { title: "Social", icon: <Users size={16} /> },
  { title: "Workflows", icon: <GitBranch size={16} /> },
];

export const Collapsed = () => (
  <NavMainShell items={menuItems} openSections={[]} />
);

export const Expanded = () => (
  <NavMainShell
    items={menuItems}
    openSections={["Analytics", "Telemetry", "Logs"]}
  />
);

export const Interactive = () => {
  const [openSections, setOpenSections] = useState<string[]>(["Analytics", "Telemetry", "Logs"]);

  return (
    <NavMainShell
      items={menuItems}
      openSections={openSections}
      onSectionToggle={(key, open) =>
        setOpenSections((prev) => open ? [...prev, key] : prev.filter((k) => k !== key))
      }
      onItemClick={(item) => console.log("clicked:", item.title)}
    />
  );
};
