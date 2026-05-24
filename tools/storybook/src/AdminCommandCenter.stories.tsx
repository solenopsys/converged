import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, useRef, useEffect } from "react";
import { AlertTriangle, ArrowUpRight, FileText, Gauge, PackageCheck, CornerDownLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, InputShell, ScrollArea } from "front-core";

type Tone = "neutral" | "attention" | "positive";

type CommandEntry = {
  id: string;
  time: string;
  query: string;
  response: string | null;
};

type StreamObject = {
  fields: Array<[string, string]>;
  icon: LucideIcon;
  title: string;
};

type StreamItem = {
  action?: string;
  body: string;
  id: string;
  object?: StreamObject;
  source: string;
  time: string;
  title: string;
  tone?: Tone;
};

type Signal = {
  detail: string;
  label: string;
  series: number[];
  tone?: Tone;
  value: string;
};

const stream: StreamItem[] = [
  {
    id: "request-ready",
    time: "09:51",
    source: "New request",
    title: "Bracket assembly is ready for automatic quote",
    body: "Files parsed, material and tolerance are present. AI can produce route and price estimate without manager review.",
    tone: "positive",
    action: "Generate quote",
    object: {
      icon: PackageCheck,
      title: "Petrov A.V. · 12 pcs · D16T aluminum",
      fields: [
        ["process", "5-axis milling"],
        ["size", "180 x 94 x 52 mm"],
        ["deadline", "May 26"],
      ],
    },
  },
  {
    id: "ivanov-blocked",
    time: "09:42",
    source: "AI intake",
    title: "Ivanov order cannot be quoted yet",
    body: "Missing alloy grade and seating diameter tolerance. One short clarification is faster than escalating the order.",
    tone: "attention",
    action: "Draft question",
    object: {
      icon: AlertTriangle,
      title: "Ivanov · turning · urgent",
      fields: [
        ["missing", "material spec"],
        ["missing", "diameter tolerance"],
        ["status", "quote blocked"],
      ],
    },
  },
  {
    id: "planner-vmx42",
    time: "09:35",
    source: "AI planner",
    title: "Use VMX42 for plate housing",
    body: "VMX42 opens at 11:00. Booking it keeps Friday delivery and leaves DMU 50 free for 5-axis work.",
    action: "Reserve slot",
  },
  {
    id: "material-accepted",
    time: "09:18",
    source: "Mailings",
    title: "Customer accepted material substitution",
    body: "AISI 304 replacement approved. Friday deadline holds if laser cutting starts before 14:00.",
    tone: "positive",
  },
  {
    id: "nlx-changed",
    time: "09:05",
    source: "Production",
    title: "NLX 2500 queue changed",
    body: "Turning-mill cell is busy until 21:00. Two shaft jobs can shift to morning without deadline risk.",
    action: "Rebalance",
  },
  {
    id: "step-parsed",
    time: "08:54",
    source: "Files",
    title: "STEP file parsed for quote #1842",
    body: "Thin wall risk found near two threaded holes. Inspection pack can be generated after route approval.",
    object: {
      icon: FileText,
      title: "housing_v7.step",
      fields: [
        ["geometry", "valid"],
        ["risk", "thin wall"],
        ["next", "route approval"],
      ],
    },
  },
];

const signals: Signal[] = [
  { label: "Requests", value: "18", detail: "5 need route check", series: [23, 22, 21, 23, 20, 19, 18] },
  { label: "Machines", value: "14 / 47", detail: "in work now", series: [9, 10, 12, 12, 13, 14, 14], tone: "positive" },
  { label: "Decisions", value: "3", detail: "blocking quote flow", series: [1, 1, 2, 2, 4, 3, 3], tone: "attention" },
  { label: "Queue", value: "2.6 d", detail: "median deadline", series: [3.2, 3.1, 2.9, 3.0, 2.8, 2.7, 2.6] },
];

const machineLoad = [
  { label: "busy", value: 14 },
  { label: "available", value: 6 },
  { label: "idle", value: 22 },
  { label: "service", value: 5 },
];

const riskRows = [
  ["Ivanov", "missing material + tolerance", "blocked"],
  ["Quote #1842", "thin wall needs route decision", "review"],
  ["NLX 2500", "queue moved to 21:00", "watch"],
  ["VMX42", "slot opens from 11:00", "ready"],
];

function Sparkline({ values, tone = "neutral" }: { values: number[]; tone?: Tone }) {
  const width = 132;
  const height = 42;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 6) - 3;
    return { x, y };
  });
  const path = points.reduce((acc, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    const prev = points[index - 1];
    const cx = ((prev.x + point.x) / 2).toFixed(1);
    return `${acc} C ${cx} ${prev.y.toFixed(1)} ${cx} ${point.y.toFixed(1)} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, "");
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg className="sparkline" data-tone={tone} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={area} className="sparkline__area" />
      <path d={path} className="sparkline__line" />
    </svg>
  );
}

function LoadChart() {
  const total = machineLoad.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader className="ss-section-head">
        <h3>Machine load</h3>
        <span>47 machines</span>
      </CardHeader>
      <CardContent className="ss-load-body">
        <div className="ss-load-bar" aria-hidden="true">
          {machineLoad.map((item) => (
            <i key={item.label} data-kind={item.label} style={{ width: `${(item.value / total) * 100}%` }} />
          ))}
        </div>
        <div className="ss-load-legend">
          {machineLoad.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const INITIAL_COMMANDS: CommandEntry[] = [
  {
    id: "c0",
    time: "09:38",
    query: "машин активных сколько",
    response: "14 / 47 машин в работе · VMX42 и DMU 50 — приоритет до 14:00",
  },
  {
    id: "c1",
    time: "09:44",
    query: "что блокирует поток заявок",
    response: "3 решения ждут менеджера: Иванов (спецификация), DMU 50 (маршрут), Quote #1842 (тонкая стенка)",
  },
];

function mockResponse(query: string): string {
  const q = query.toLowerCase();
  if (q.includes("маш") || q.includes("станк")) return "14 / 47 машин активны · NLX 2500 занят до 21:00";
  if (q.includes("заявк") || q.includes("заказ")) return "18 заявок · 5 ждут проверки · 2 можно выдать без менеджера";
  if (q.includes("лог") || q.includes("ошиб")) return "Последние 50 записей: 2 warning, 0 error, 0 critical";
  if (q.includes("маршрут") || q.includes("vmx") || q.includes("dmu")) return "VMX42 открывается в 11:00 — слот зарезервировать?";
  if (q.includes("материал") || q.includes("aisi") || q.includes("замен")) return "Замена AISI 304 одобрена клиентом. Дедлайн в пятницу — в норме.";
  if (q.includes("очередь") || q.includes("приоритет")) return "Медиана очереди 2.6 д · 2 вала можно перенести на утро без риска";
  return "Команда принята. Анализирую контекст...";
}

function CommandPanel() {
  const [commands, setCommands] = useState<CommandEntry[]>(INITIAL_COMMANDS);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [commands]);

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;
    const now = new Date();
    const time = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const id = `c${Date.now()}`;
    setCommands((prev) => [...prev, { id, time, query: text.trim(), response: null }]);
    setDraft("");

    setTimeout(() => {
      setCommands((prev) =>
        prev.map((c) => (c.id === id ? { ...c, response: mockResponse(text) } : c)),
      );
    }, 600);
  };

  return (
    <aside className="ss-commands" aria-label="Command channel">
      <div className="ss-col-head">
        <div>
          <h2>Commands</h2>
          <p>natural language</p>
        </div>
        <CornerDownLeft aria-hidden="true" size={18} />
      </div>

      <div className="ss-scroll ss-cmd-list" ref={listRef}>
        {commands.map((cmd) => (
          <div className="ss-cmd-entry" key={cmd.id}>
            <div className="ss-cmd-meta">
              <time>{cmd.time}</time>
            </div>
            <p className="ss-cmd-query">{cmd.query}</p>
            {cmd.response !== null ? (
              <p className="ss-cmd-response">{cmd.response}</p>
            ) : (
              <p className="ss-cmd-response ss-cmd-response--thinking">думаю...</p>
            )}
          </div>
        ))}
      </div>

      <div className="ss-cmd-input-wrap">
        <InputShell
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          placeholder="Спросить или дать команду…"
          className="ss-cmd-input"
        />
        <button
          type="button"
          className="ss-cmd-send"
          onClick={() => handleSubmit(draft)}
          aria-label="Отправить команду"
          disabled={!draft.trim()}
        >
          <CornerDownLeft size={15} />
        </button>
      </div>
    </aside>
  );
}

function StateStream() {
  return (
    <main className="ss">
      <style>{css}</style>

      <header className="ss-top">
        <div className="ss-title">
          <span className="ss-title__dot" aria-hidden="true" />
          <h1>State stream</h1>
        </div>
        <p>Two live flows: what happened, and what the system state looks like now.</p>
      </header>

      <div className="ss-grid">
        <section className="ss-events" aria-label="Events">
          <div className="ss-col-head">
            <h2>Events</h2>
            <span>latest first · 09:52</span>
          </div>
          <ScrollArea className="ss-scroll">
            {stream.map((item) => (
              <StreamEvent item={item} key={item.id} />
            ))}
          </ScrollArea>
        </section>

        <aside className="ss-rail" aria-label="Current indicators">
          <div className="ss-col-head">
            <div>
              <h2>Indicators</h2>
              <p>current state</p>
            </div>
            <Gauge aria-hidden="true" size={21} />
          </div>

          <ScrollArea className="ss-scroll">
            <div className="ss-signal-list">
              {signals.map((signal) => (
                <SignalCard key={signal.label} signal={signal} />
              ))}
            </div>

            <LoadChart />

            <section className="ss-risk" aria-label="Attention list">
              <h3>Attention</h3>
              {riskRows.map(([name, detail, status]) => (
                <div className="ss-risk-row" data-status={status} key={name}>
                  <strong>{name}</strong>
                  <span>{detail}</span>
                  <Badge variant="outline" className={`ss-badge ss-badge--${status}`}>{status}</Badge>
                </div>
              ))}
            </section>
          </ScrollArea>
        </aside>

        <CommandPanel />
      </div>
    </main>
  );
}

function StreamEvent({ item }: { item: StreamItem }) {
  return (
    <article className="ss-event" data-tone={item.tone ?? "neutral"}>
      <time>{item.time}</time>
      <div className="ss-event__main">
        <div className="ss-event__meta">
          <span>{item.source}</span>
          {item.action ? (
            <Button className="ss-event__action" size="sm" type="button" variant="ghost">
              {item.action}
              <ArrowUpRight aria-hidden="true" size={14} />
            </Button>
          ) : null}
        </div>
        <h2>{item.title}</h2>
        <p>{item.body}</p>
        {item.object ? <StreamObjectView object={item.object} /> : null}
      </div>
    </article>
  );
}

function StreamObjectView({ object }: { object: StreamObject }) {
  const Icon = object.icon;

  return (
    <Card className="ss-object">
      <CardContent className="ss-object__inner">
        <Icon aria-hidden="true" size={17} className="ss-object__icon" />
        <strong>{object.title}</strong>
        <dl>
          {object.fields.map(([label, value]) => (
            <div key={`${label}-${value}`}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  return (
    <Card className="ss-signal" data-tone={signal.tone ?? "neutral"}>
      <CardContent className="ss-signal__inner">
        <div>
          <span>{signal.label}</span>
          <strong>{signal.value}</strong>
          <p>{signal.detail}</p>
        </div>
        <Sparkline values={signal.series} tone={signal.tone ?? "neutral"} />
      </CardContent>
    </Card>
  );
}

const css = `
.ss {
  height: 100vh;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 18px;
  background: var(--ui-background);
  color: var(--ui-foreground);
  padding: 24px;
  font-variant-numeric: tabular-nums;
  box-sizing: border-box;
}

.ss * { box-sizing: border-box; }

.ss-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 450px);
  gap: 24px;
  align-items: end;
}

.ss-title {
  display: flex;
  align-items: flex-end;
  gap: 16px;
}

.ss-title__dot {
  width: 13px;
  height: 13px;
  margin-bottom: 12px;
  border-radius: 50%;
  background: var(--ui-muted-foreground);
}

.ss-title h1 {
  margin: 0;
  color: var(--ui-foreground);
  font-size: clamp(42px, 5.5vw, 76px);
  font-weight: 700;
  letter-spacing: -0.058em;
  line-height: 0.9;
}

.ss-top > p {
  margin: 0 0 8px;
  color: var(--ui-muted-foreground);
  font-size: 16px;
  line-height: 1.36;
}

.ss-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr) 300px;
  gap: 24px;
}

.ss-events, .ss-rail, .ss-commands {
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
}

.ss-commands {
  grid-template-rows: auto minmax(0, 1fr) auto;
  border-left: 1px solid var(--ui-border);
  padding-left: 20px;
}

.ss-cmd-list {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-right: 4px;
}

.ss-cmd-entry {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
}

.ss-cmd-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ss-cmd-meta time {
  color: var(--ui-muted-foreground);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.ss-cmd-query {
  margin: 0;
  color: var(--ui-foreground);
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.ss-cmd-response {
  margin: 0;
  color: var(--ui-muted-foreground);
  font-size: 13px;
  line-height: 1.42;
  padding-left: 10px;
  border-left: 2px solid var(--ui-border);
}

.ss-cmd-response--thinking {
  opacity: 0.5;
  font-style: italic;
}

.ss-cmd-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  padding: 8px 10px;
  background: color-mix(in oklch, var(--ui-muted) 60%, transparent);
  transition: border-color 0.15s;
}

.ss-cmd-input-wrap:focus-within {
  border-color: var(--ui-muted-foreground);
}

.ss-cmd-input {
  flex: 1;
  min-height: 22px;
  max-height: 96px;
  overflow: hidden;
}

.ss-cmd-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: var(--ui-muted-foreground);
  color: var(--ui-background);
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.ss-cmd-send:disabled {
  opacity: 0.3;
  cursor: default;
}

.ss-scroll {
  min-height: 0;
}

.ss-col-head {
  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--ui-border);
  background: color-mix(in oklch, var(--ui-background) 90%, transparent);
  backdrop-filter: blur(16px);
}

.ss-col-head h2 {
  margin: 0;
  color: var(--ui-foreground);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.ss-col-head span,
.ss-col-head p {
  margin: 0;
  color: var(--ui-muted-foreground);
  font-size: 13px;
  font-weight: 500;
}

.ss-col-head svg {
  color: var(--ui-muted-foreground);
}

.ss-event {
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr);
  gap: 16px;
  border-bottom: 1px solid var(--ui-border);
  padding: 15px 0;
}

.ss-event > time {
  color: var(--ui-muted-foreground);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.ss-event__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 5px;
}

.ss-event__meta span {
  color: var(--ui-muted-foreground);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.ss-event__action {
  height: 30px;
  gap: 5px;
  border-radius: 999px;
  font-size: 13px;
  padding: 0 10px;
}

.ss-event h2 {
  max-width: 760px;
  margin: 0 0 6px;
  color: var(--ui-foreground);
  font-size: clamp(20px, 1.75vw, 28px);
  font-weight: 600;
  letter-spacing: -0.038em;
  line-height: 1.06;
}

.ss-event p {
  max-width: 760px;
  margin: 0;
  color: var(--ui-muted-foreground);
  font-size: 15px;
  line-height: 1.42;
}

.ss-event[data-tone="attention"] h2 { color: var(--ui-chart-4); }
.ss-event[data-tone="positive"] h2  { color: var(--ui-chart-2); }

.ss-object {
  max-width: 860px;
  margin-top: 10px;
}

.ss-object__inner {
  display: grid;
  grid-template-columns: 22px minmax(190px, 0.72fr) minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
}

.ss-object__icon { color: var(--ui-muted-foreground); }

.ss-object__inner strong {
  overflow: hidden;
  color: var(--ui-foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.025em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ss-object__inner dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.ss-object__inner dt {
  color: var(--ui-muted-foreground);
  font-size: 12px;
  font-weight: 500;
}

.ss-object__inner dd {
  overflow: hidden;
  margin: 1px 0 0;
  color: var(--ui-foreground);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ss-rail {
  border-left: 1px solid var(--ui-border);
  padding-left: 24px;
}

.ss-signal-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.ss-signal { }

.ss-signal:first-child {
  grid-column: span 2;
}

.ss-signal__inner {
  display: grid;
  grid-template-columns: 1fr;
  align-content: space-between;
  gap: 12px;
  min-height: 152px;
  padding: 14px;
}

.ss-signal:first-child .ss-signal__inner {
  grid-template-columns: minmax(0, 0.7fr) minmax(180px, 1fr);
  align-items: end;
  min-height: 168px;
}

.ss-signal__inner span {
  color: var(--ui-muted-foreground);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.ss-signal__inner strong {
  display: block;
  margin-top: 8px;
  color: var(--ui-foreground);
  font-size: 32px;
  font-weight: 650;
  letter-spacing: -0.055em;
  line-height: 0.9;
}

.ss-signal__inner p {
  margin: 8px 0 0;
  color: var(--ui-muted-foreground);
  font-size: 13px;
  line-height: 1.25;
}

.ss-signal[data-tone="attention"] .ss-signal__inner strong { color: var(--ui-chart-4); }
.ss-signal[data-tone="positive"]  .ss-signal__inner strong { color: var(--ui-chart-2); }

.sparkline { width: 100%; height: 58px; overflow: visible; }
.ss-signal:first-child .sparkline { height: 78px; }

.sparkline__area { fill: color-mix(in oklch, var(--ui-muted-foreground) 12%, transparent); }
.sparkline__line { fill: none; stroke: var(--ui-muted-foreground); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }

.sparkline[data-tone="attention"] .sparkline__area { fill: color-mix(in oklch, var(--ui-chart-4) 14%, transparent); }
.sparkline[data-tone="attention"] .sparkline__line { stroke: var(--ui-chart-4); }
.sparkline[data-tone="positive"]  .sparkline__area { fill: color-mix(in oklch, var(--ui-chart-2) 14%, transparent); }
.sparkline[data-tone="positive"]  .sparkline__line { stroke: var(--ui-chart-2); }

.ss-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
}

.ss-section-head h3 {
  margin: 0;
  color: var(--ui-foreground);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.ss-section-head span {
  color: var(--ui-muted-foreground);
  font-size: 13px;
}

.ss-load-body { padding: 0 14px 14px; display: grid; gap: 12px; }

.ss-load-bar {
  display: flex;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-muted);
}

.ss-load-bar i { display: block; min-width: 2px; }
.ss-load-bar [data-kind="busy"]      { background: var(--ui-muted-foreground); }
.ss-load-bar [data-kind="available"] { background: var(--ui-chart-2); }
.ss-load-bar [data-kind="idle"]      { background: var(--ui-border); }
.ss-load-bar [data-kind="service"]   { background: var(--ui-chart-4); }

.ss-load-legend {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 14px;
}

.ss-load-legend div { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ss-load-legend span   { color: var(--ui-muted-foreground); font-size: 13px; }
.ss-load-legend strong { color: var(--ui-foreground); font-size: 14px; font-weight: 600; }

.ss-risk { padding-top: 12px; }

.ss-risk h3 {
  margin: 0 0 10px;
  color: var(--ui-foreground);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.ss-risk-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 10px;
  border-top: 1px solid var(--ui-border);
  padding: 13px 0;
  align-items: center;
}

.ss-risk-row strong { color: var(--ui-foreground); font-size: 16px; font-weight: 600; letter-spacing: -0.025em; }
.ss-risk-row span   { grid-column: 1; color: var(--ui-muted-foreground); font-size: 13px; line-height: 1.25; }

.ss-badge { grid-column: 2; grid-row: 1 / span 2; align-self: center; }
.ss-badge--blocked, .ss-badge--review { border-color: var(--ui-chart-4); color: var(--ui-chart-4); }
.ss-badge--ready                      { border-color: var(--ui-chart-2); color: var(--ui-chart-2); }

@media (max-width: 1280px) {
  .ss-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .ss-commands { grid-column: 1 / -1; grid-template-rows: auto 180px auto; border-left: 0; padding-left: 0; border-top: 1px solid var(--ui-border); padding-top: 16px; }
}

@media (max-width: 1040px) {
  .ss { padding: 16px; }
  .ss-top, .ss-grid { grid-template-columns: 1fr; }
  .ss-title h1 { font-size: clamp(42px, 10vw, 68px); }
  .ss-rail { grid-row: 1; border-left: 0; padding-left: 0; }
  .ss-signal-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ss-signal__inner { min-height: 145px; }
  .ss-risk { display: none; }
  .ss-commands { grid-column: auto; }
}

@media (max-width: 640px) {
  .ss { gap: 16px; padding: 12px; }
  .ss-top > p, .ss-event p { font-size: 15px; }
  .ss-event { grid-template-columns: 46px minmax(0, 1fr); gap: 12px; padding: 15px 0; }
  .ss-event h2 { font-size: 22px; }
  .ss-object__inner { grid-template-columns: 22px minmax(0, 1fr); }
  .ss-object__inner dl { grid-column: 1 / -1; grid-template-columns: 1fr; }
  .ss-signal__inner { min-height: 138px; grid-template-columns: 1fr; }
  .ss-signal:first-child .ss-signal__inner { grid-column: auto; grid-template-columns: 1fr; }
  .ss-signal-list { grid-template-columns: 1fr; }
}
`;

const meta = {
  title: "App/StateStream",
  component: StateStream,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof StateStream>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Concept: Story = {};
