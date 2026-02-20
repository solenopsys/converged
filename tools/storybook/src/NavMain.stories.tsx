import type { Meta } from "@storybook/react-vite";
import { useState } from "react";
import { NavMainShell, type MenuItemData } from "front-core";

const meta: Meta = {
  title: "Components/NavMain",
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 260, background: "hsl(var(--background))", color: "hsl(var(--foreground))", padding: 8 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

const menuItems: MenuItemData[] = [
  { title: "AI" },
  { title: "Sales" },
  {
    title: "Geo",
    items: [
      { title: "Geo", items: [{ title: "List" }, { title: "Tree" }] },
      { title: "Places", items: [{ title: "Queries" }, { title: "Objects" }] },
    ],
  },
  {
    title: "Workflows",
    items: [
      { title: "dag", items: [{ title: "contexts" }, { title: "executions" }] },
      { title: "sheduller", items: [{ title: "crons" }, { title: "history" }] },
    ],
  },
  {
    title: "Analytics",
    items: [
      { title: "Telemetry", items: [{ title: "Hot" }, { title: "Cold" }] },
      { title: "Logs", items: [{ title: "Hot" }, { title: "Cold" }] },
    ],
  },
  {
    title: "Data",
    items: [
      { title: "Dumps", items: [{ title: "Files" }, { title: "Storages" }] },
    ],
  },
];

export const Collapsed = () => (
  <NavMainShell items={menuItems} openSections={[]} />
);

export const Expanded = () => (
  <NavMainShell
    items={menuItems}
    openSections={["Geo", "Workflows", "dag", "sheduller"]}
  />
);

export const Interactive = () => {
  const [openSections, setOpenSections] = useState<string[]>(["Geo", "Workflows"]);

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
