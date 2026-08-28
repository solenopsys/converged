import { render } from "preact";
import { useState } from "preact/hooks";
import { Pin, Trash2, X } from "/home/alexstorm/distrib/business/converged/core/frontend/front-core/src/icons";
import { TabStrip, type TopBarTab } from "/home/alexstorm/distrib/business/converged/core/frontend/front-core/src/shell/TabStrip";

const TITLES = [
  "Create or prefill an email",
  "Компании",
  "Заказы 4128",
  "Рассылка · июль",
  "Маркер ошибок",
  "География продаж",
];

function Demo() {
  const [tabs, setTabs] = useState(
    TITLES.map((title, i) => ({ key: `k${i}`, title, pinned: i === 1, active: i === 0 })),
  );

  const views: TopBarTab[] = tabs.map((t) => ({
    ...t,
    actions: [
      { id: "pin", label: t.pinned ? "Открепить" : "Закрепить", icon: Pin },
      { id: "close", label: "Закрыть", icon: X },
      { id: "close-transient", label: "Закрыть незакреплённые", icon: Trash2, danger: true },
    ],
  }));

  return (
    <header class="top-bar">
      <a class="top-bar-brand" href="#">CONVERGED</a>
      <TabStrip
        tabs={views}
        label="Workspace tabs"
        onSelect={(key) => setTabs((s) => s.map((t) => ({ ...t, active: t.key === key })))}
        onClose={(key) => setTabs((s) => s.filter((t) => t.key !== key))}
        onPinToggle={(key) => setTabs((s) => s.map((t) => (t.key === key ? { ...t, pinned: !t.pinned } : t)))}
        onAction={(key, id) => {
          if (id === "pin") setTabs((s) => s.map((t) => (t.key === key ? { ...t, pinned: !t.pinned } : t)));
          if (id === "close") setTabs((s) => s.filter((t) => t.key !== key));
          if (id === "close-transient") setTabs((s) => s.filter((t) => t.pinned));
        }}
      />
      <div class="top-bar-controls"><button type="button" class="top-bar-control">T</button></div>
    </header>
  );
}

render(<Demo />, document.getElementById("root")!);
