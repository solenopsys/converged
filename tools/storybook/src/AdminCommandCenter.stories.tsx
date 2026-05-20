import type { Meta, StoryObj } from "@storybook/react-vite";

// ─── Chart helpers ─────────────────────────────────────────────────────────

let _id = 0;
const uid = () => `c${++_id}`;

function smoothPath(pts: { x: number; y: number }[]): string {
  return pts.reduce((acc, p, i) => {
    if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cx = ((prev.x + p.x) / 2).toFixed(1);
    return `${acc} C${cx},${prev.y.toFixed(1)} ${cx},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }, "");
}

// ─── Area chart ────────────────────────────────────────────────────────────

function AreaChart({
  data,
  xLabels,
  color = "rgba(150,165,210,0.9)",
}: {
  data: number[];
  xLabels: string[];
  color?: string;
}) {
  const id = uid();
  const VW = 270, VH = 88;
  const pL = 26, pR = 4, pT = 6, pB = 18;
  const cW = VW - pL - pR, cH = VH - pT - pB;
  const max = Math.max(...data);

  const pts = data.map((v, i) => ({
    x: pL + (i / (data.length - 1)) * cW,
    y: pT + (1 - v / max) * cH,
  }));

  const line = smoothPath(pts);
  const area = `${line} L${(pL + cW).toFixed(1)},${(pT + cH).toFixed(1)} L${pL.toFixed(1)},${(pT + cH).toFixed(1)}Z`;

  const ticks = [0, Math.floor((xLabels.length - 1) / 2), xLabels.length - 1];
  const yTicks = [0, 0.5, 1];

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" aria-hidden="true" className="ws-achart">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((frac) => {
        const y = pT + frac * cH;
        const val = Math.round(max * (1 - frac));
        return (
          <g key={frac}>
            <line x1={pL} y1={y} x2={pL + cW} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={pL - 3} y={y + 3.5} fontSize="8.5" fill="rgba(255,255,255,0.2)" textAnchor="end" fontFamily="SF Mono,JetBrains Mono,monospace">
              {val}
            </text>
          </g>
        );
      })}

      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

      {ticks.map((idx) => (
        <text key={idx} x={pts[idx].x} y={VH - 3} fontSize="8.5" fill="rgba(255,255,255,0.2)" textAnchor="middle">
          {xLabels[idx]}
        </text>
      ))}
    </svg>
  );
}

// ─── Donut chart ───────────────────────────────────────────────────────────

type DonutSeg = { label: string; value: number; color: string };

function DonutChart({ segments }: { segments: DonutSeg[] }) {
  const S = 96, cx = 48, cy = 48, r = 34, sw = 11;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0);

  let cum = 0;
  const arcs = segments.map((s) => {
    const len = (s.value / total) * C;
    const offset = C - cum;
    cum += len;
    return { ...s, len, offset };
  });

  return (
    <div className="ws-donut">
      <svg viewBox={`0 0 ${S} ${S}`} width={S} height={S} aria-hidden="true">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={sw} />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={sw}
            strokeDasharray={`${arc.len.toFixed(2)} ${(C - arc.len).toFixed(2)}`}
            strokeDashoffset={arc.offset.toFixed(2)}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="800" fill="rgba(230,230,240,0.9)" fontFamily="SF Mono,JetBrains Mono,monospace" letterSpacing="-1">
          {total}
        </text>
      </svg>
      <div className="ws-donut__legend">
        {segments.map((s) => (
          <div className="ws-donut__item" key={s.label}>
            <span className="ws-donut__dot" style={{ background: s.color }} />
            <span className="ws-donut__lbl">{s.label}</span>
            <span className="ws-donut__val">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Feed types ────────────────────────────────────────────────────────────

type ObjectData = { type: "order" | "machine" | "file"; title: string; lines: string[] };

type RequestParam = { label: string; value: string };
type RequestFile  = { name: string; ext: "step" | "pdf" | "dxf" };

type FeedItem =
  | { kind: "alert";    id: string; time: string; source: string; title: string; body: string; action?: string; rec?: string; recCta?: string; object?: ObjectData }
  | { kind: "event" | "resolved"; id: string; time: string; source: string; title: string; body: string; action?: string; object?: ObjectData }
  | { kind: "bot";      id: string; time: string; body: string }
  | { kind: "request";  id: string; time: string; client: string; part: string; qty: number; params: RequestParam[]; files: RequestFile[]; aiNote?: string };

// ─── Feed data ─────────────────────────────────────────────────────────────

const feed: FeedItem[] = [
  {
    kind: "request", id: "r1", time: "09:51",
    client: "Petrov A.V.",
    part: "Bracket assembly",
    qty: 12,
    params: [
      { label: "material",   value: "D16T aluminum" },
      { label: "process",    value: "5-axis milling" },
      { label: "size",       value: "180 × 94 × 52 mm" },
      { label: "tolerance",  value: "±0.05 · IT7 bores" },
      { label: "deadline",   value: "May 26 · 6 d" },
    ],
    files: [
      { name: "bracket_v3.step",  ext: "step" },
      { name: "drawing_rev2.pdf", ext: "pdf" },
    ],
    aiNote: "Can generate quote in ~4 min",
  },
  {
    kind: "alert", id: "a1", time: "09:42", source: "AI intake",
    title: "Ivanov order cannot be quoted yet",
    body: "Missing alloy grade and seating diameter tolerance. One short clarification is faster than a manager review.",
    action: "Draft question",
    rec: "Ask Ivanov for material spec and tolerance. Keep VMX42 slot for the plate housing.",
    recCta: "Create next-hour plan",
    object: { type: "order", title: "Ivanov · turning · urgent", lines: ["material missing", "tolerance missing", "quote blocked"] },
  },
  {
    kind: "bot", id: "b1", time: "09:35",
    body: "VMX42 slot opens at 11:00 — aluminum route confirmed. Booking it locks Friday and keeps DMU 50 free for 5-axis all day.",
  },
  {
    kind: "event", id: "e1", time: "09:31", source: "Sales inbox",
    title: "Plate housing moved to route check",
    body: "24 pcs aluminum housing. VMX42 can start today; DMU 50 stays reserved for 5-axis work.",
    action: "Open route",
    object: { type: "machine", title: "VMX42 available today", lines: ["1067×610 travel", "aluminum route", "no deadline risk"] },
  },
  {
    kind: "resolved", id: "e2", time: "09:18", source: "Mailings",
    title: "Customer accepted material substitution",
    body: "AISI 304 approved. Friday deadline holds if laser starts before 14:00.",
  },
  {
    kind: "event", id: "e3", time: "09:05", source: "Production",
    title: "NLX 2500 queue changed",
    body: "Turning-mill busy until 21:00. Two shaft jobs can shift to morning without deadline risk.",
    action: "Rebalance",
  },
];

// ─── Indicator data ─────────────────────────────────────────────────────────

const stats = [
  { value: "7",   label: "orders done", sub: "of 18 queued" },
  { value: "142", label: "parts machined", sub: "+23 since 08:00" },
];

const queueData   = { labels: ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00"], values: [24, 22, 21, 23, 20, 19, 18] };
const throughData = { labels: ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00"], values: [8, 12, 15, 11, 17, 19, 21] };

const orderDonut: DonutSeg[] = [
  { label: "in progress", value: 8,  color: "rgba(90,159,212,0.85)" },
  { label: "queued",      value: 6,  color: "rgba(196,150,61,0.85)" },
  { label: "done",        value: 4,  color: "rgba(77,184,106,0.85)" },
  { label: "blocked",     value: 2,  color: "rgba(196,90,90,0.75)" },
];

const machineDonut: DonutSeg[] = [
  { label: "busy",        value: 14, color: "rgba(90,159,212,0.85)" },
  { label: "idle",        value: 22, color: "rgba(70,70,90,0.7)" },
  { label: "available",   value: 6,  color: "rgba(77,184,106,0.85)" },
  { label: "maintenance", value: 3,  color: "rgba(196,150,61,0.85)" },
  { label: "down",        value: 2,  color: "rgba(196,90,90,0.75)" },
];

// ─── Feed components ────────────────────────────────────────────────────────

function AlertBlock({ item }: { item: Extract<FeedItem, { kind: "alert" }> }) {
  return (
    <section className="ws-alert">
      <div className="ws-hd">
        <span className="ws-src ws-src--alert">{item.source}</span>
        <time className="ws-time">{item.time}</time>
      </div>
      <h2 className="ws-alert__h">{item.title}</h2>
      <p className="ws-body">{item.body}</p>
      {item.rec && (
        <p className="ws-rec">
          <span className="ws-rec__mark" aria-hidden="true">◆</span>
          {item.rec}
        </p>
      )}
    </section>
  );
}

function EventBlock({ item }: { item: Extract<FeedItem, { kind: "event" | "resolved" }> }) {
  return (
    <section className="ws-event" data-resolved={item.kind === "resolved" || undefined}>
      <div className="ws-hd">
        <span className="ws-src">{item.source}</span>
        <time className="ws-time">{item.time}</time>
      </div>
      <h3 className="ws-event__h">{item.title}</h3>
      <p className="ws-body">{item.body}</p>
    </section>
  );
}

function BotBlock({ item }: { item: Extract<FeedItem, { kind: "bot" }> }) {
  return (
    <section className="ws-bot">
      <p className="ws-bot__text">
        <span className="ws-bot__mark" aria-hidden="true">◆</span>
        {item.body}
        <time className="ws-bot__time">{item.time}</time>
      </p>
    </section>
  );
}

function Divider({ label }: { label: string }) {
  return <div className="ws-div">{label}</div>;
}

function RequestCard({ item }: { item: Extract<FeedItem, { kind: "request" }> }) {
  const files = item.files.map((f) => f.name).join("  ·  ");

  return (
    <section className="ws-req">
      <div className="ws-hd">
        <span className="ws-src ws-src--new">new request</span>
        <time className="ws-time">{item.time}</time>
      </div>

      <h2 className="ws-req__part">{item.part}</h2>
      <p className="ws-req__meta">{item.client} · {item.qty} pcs</p>

      <dl className="ws-req__params">
        {item.params.map((p) => (
          <div className="ws-req__row" key={p.label}>
            <dt>{p.label}</dt>
            <dd>{p.value}</dd>
          </div>
        ))}
      </dl>

      <p className="ws-req__files">
        {files}
        {item.aiNote && <span className="ws-req__ai"> · ◆ {item.aiNote}</span>}
      </p>
    </section>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  if (item.kind === "alert")   return <AlertBlock   item={item} />;
  if (item.kind === "bot")     return <BotBlock     item={item} />;
  if (item.kind === "request") return <RequestCard  item={item} />;
  return <EventBlock item={item as Extract<FeedItem, { kind: "event" | "resolved" }>} />;
}

// ─── Indicators ─────────────────────────────────────────────────────────────

function IndicatorsPanel() {
  return (
    <aside className="ws-ind" aria-label="Indicators">

      {/* stat cards */}
      <div className="ws-ind__row">
        {stats.map((s) => (
          <div className="ws-icard" key={s.label}>
            <div className="ws-icard__val">{s.value}</div>
            <div className="ws-icard__label">{s.label}</div>
            <div className="ws-icard__sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* area charts */}
      <div className="ws-ind__row">
        <div className="ws-icard ws-icard--chart">
          <div className="ws-icard__title">Queue depth</div>
          <AreaChart data={queueData.values} xLabels={queueData.labels} color="rgba(196,150,61,0.85)" />
        </div>
        <div className="ws-icard ws-icard--chart">
          <div className="ws-icard__title">Parts / hour</div>
          <AreaChart data={throughData.values} xLabels={throughData.labels} color="rgba(90,159,212,0.85)" />
        </div>
      </div>

      {/* donuts */}
      <div className="ws-ind__row">
        <div className="ws-icard ws-icard--donut">
          <div className="ws-icard__title">Order status</div>
          <DonutChart segments={orderDonut} />
        </div>
        <div className="ws-icard ws-icard--donut">
          <div className="ws-icard__title">Machines</div>
          <DonutChart segments={machineDonut} />
        </div>
      </div>

    </aside>
  );
}

// ─── Root ───────────────────────────────────────────────────────────────────

function StateStream() {
  return (
    <main className="ws-root">
      <style>{css}</style>

      <header className="ws-bar" aria-label="Status">
        <span className="ws-bar__dot" aria-hidden="true" />
        <span className="ws-bar__name">Workshop</span>
        <span className="ws-bar__sep" aria-hidden="true" />
        <span className="ws-bar__stat"><b>18</b> requests</span>
        <span className="ws-bar__stat"><b>14/47</b> machines</span>
        <span className="ws-bar__stat"><b>3</b> decisions</span>
        <span className="ws-bar__stat"><b>2.6 d</b> queue</span>
        <span className="ws-bar__spacer" />
        <span className="ws-bar__live"><span className="ws-bar__pulse" aria-hidden="true" />live</span>
      </header>

      <div className="ws-body">
        <div className="ws-stream" aria-label="Event stream">
          {feed.slice(0, 4).map((item) => <FeedCard item={item} key={item.id} />)}
          <Divider label="Earlier today" />
          {feed.slice(4).map((item) => <FeedCard item={item} key={item.id} />)}
        </div>
        <IndicatorsPanel />
      </div>

    </main>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const css = `
/*
  Type scale — 4 sizes only:

    display  clamp(24px, 3vw, 38px)  weight 800  tracking -0.06em  lh 0.95
    title    18px                    weight 700  tracking -0.03em  lh 1.1
    body     14px                    weight 400  tracking  0       lh 1.55
    label    11px / uppercase        weight 700  tracking  0.07em  lh 1

  Everything maps to one of these four.
  Metric numbers are the one exception: monospace, intentionally large.
*/

.ws-root {
  --bg:    #08080a;
  --s1:    #0f0f12;
  --s2:    #191920;
  --ink:   #e6e6ea;
  --sub:   #60616a;
  --dim:   #383840;
  --amber: #c4963d;
  --green: #4db86a;

  --t-display:  clamp(24px, 3vw, 38px);
  --t-title:    18px;
  --t-body:     14px;
  --t-label:    11px;

  --w-heavy:    800;
  --w-bold:     700;
  --w-normal:   400;

  --ls-display: -0.06em;
  --ls-title:   -0.03em;
  --ls-label:    0.07em;

  min-height: 100vh;
  display: grid;
  grid-template-rows: 40px 1fr;
  background: var(--bg);
  color: var(--ink);
  font-size: var(--t-body);
  font-family: -apple-system, "Inter", sans-serif;
  line-height: 1.55;
  font-variant-numeric: tabular-nums;
  box-sizing: border-box;
}
.ws-root * { box-sizing: border-box; }

/* ── bar ── */
.ws-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 18px;
  border-bottom: 1px solid var(--s2);
  color: var(--sub);
}
.ws-bar__dot   { width:6px;height:6px;border-radius:50%;background:var(--amber);flex-shrink:0; }
.ws-bar__name  { font-size:var(--t-label);font-weight:var(--w-bold);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--ink); }
.ws-bar__sep   { width:1px;align-self:stretch;background:var(--s2); }
.ws-bar__stat  { font-size:var(--t-label);color:var(--sub); }
.ws-bar__stat b { color:var(--ink);font-weight:var(--w-bold); }
.ws-bar__spacer { flex:1; }
.ws-bar__live  { display:flex;align-items:center;gap:6px;font-size:var(--t-label);font-weight:var(--w-bold);letter-spacing:var(--ls-label);text-transform:uppercase;color:var(--dim); }
.ws-bar__pulse { width:5px;height:5px;border-radius:50%;background:var(--green);animation:pulse 2.5s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:1}50%{opacity:.3} }

/* ── layout ── */
.ws-body { display:grid;grid-template-columns:minmax(0,1fr) 280px;min-height:0;overflow:hidden; }
.ws-stream { overflow-y:auto;padding:0 28px 40px;border-right:1px solid var(--s2);scrollbar-width:thin;scrollbar-color:var(--s2) transparent; }

/* ── feed shared ── */
.ws-hd  { display:flex;align-items:center;gap:8px;margin-bottom:6px; }
.ws-src { font-size:var(--t-label);font-weight:var(--w-bold);color:var(--sub); }
.ws-src--alert { color:var(--amber); }
.ws-src--new   { color:rgba(90,175,110,.85); }
.ws-time { font-size:var(--t-label);color:var(--dim); }
.ws-body { margin:0;color:var(--sub); }

/* ── alert ── */
.ws-alert { padding:26px 0 22px; }
.ws-alert__h { margin:0 0 8px;font-size:var(--t-display);font-weight:var(--w-heavy);letter-spacing:var(--ls-display);line-height:0.95;color:var(--ink); }

/* rec — same body size, amber mark, text link CTA */
.ws-rec { margin:10px 0 0;color:var(--sub); }
.ws-rec__mark { color:var(--amber);opacity:.65;font-size:9px;margin-right:6px; }
.ws-rec__link { background:transparent;border:0;color:var(--sub);cursor:pointer;font:inherit;font-size:var(--t-label);font-weight:var(--w-bold);padding:0;margin-left:8px;text-decoration:underline;text-underline-offset:2px;transition:color 100ms; }
.ws-rec__link:hover { color:var(--ink); }

/* ── bot ── */
.ws-bot { padding:2px 0 20px; }
.ws-bot__text { margin:0;color:rgba(168,178,218,.45); }
.ws-bot__mark { color:rgba(106,170,240,.35);font-size:9px;margin-right:7px; }
.ws-bot__time { font-size:var(--t-label);color:var(--dim);margin-left:9px; }

/* ── event ── */
.ws-event { padding:18px 0;border-top:1px solid var(--s2); }
.ws-event[data-resolved] { opacity:.38; }
.ws-event__h { margin:0 0 4px;font-size:var(--t-title);font-weight:var(--w-bold);letter-spacing:var(--ls-title);line-height:1.1;color:var(--ink); }
.ws-event__body { margin:0;color:var(--sub); }

.ws-div { display:flex;align-items:center;gap:12px;padding:18px 0 4px;font-size:var(--t-label);font-weight:var(--w-bold);color:var(--dim); }
.ws-div::after { content:'';flex:1;height:1px;background:var(--s2); }

/* ── request card ── */
.ws-req { padding:20px 0 22px;border-top:1px solid var(--s2); }
.ws-req__part  { margin:0 0 2px;font-size:var(--t-title);font-weight:var(--w-bold);letter-spacing:var(--ls-title);line-height:1.1;color:var(--ink); }
.ws-req__meta  { margin:0 0 12px;color:var(--sub); }

/* params as a compact definition list — label left, value right */
.ws-req__params { margin:0 0 10px;display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--s2);border:1px solid var(--s2);border-radius:6px;overflow:hidden; }
.ws-req__row    { display:flex;flex-direction:column;gap:2px;padding:7px 10px;background:var(--bg); }
.ws-req__row dt { font-size:var(--t-label);font-weight:var(--w-bold);color:var(--dim);letter-spacing:var(--ls-label);text-transform:uppercase; }
.ws-req__row dd { margin:0;color:var(--ink); }

.ws-req__files { margin:0;color:var(--dim); }
.ws-req__ai    { color:var(--dim); }

/* ── indicators ── */
.ws-ind { overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:var(--s2) transparent; }
.ws-ind__row { display:grid;grid-template-columns:1fr 1fr;gap:8px; }

.ws-icard { background:var(--s1);border:1px solid var(--s2);border-radius:10px;padding:14px; }
.ws-icard--chart { padding:12px 12px 8px; }
.ws-icard--donut { padding:12px; }

/* metric number is the one intentional exception to the scale:
   large monospace data display, not a heading */
.ws-icard__val   { font-size:30px;font-weight:var(--w-heavy);letter-spacing:-0.06em;line-height:1;font-family:"SF Mono","JetBrains Mono",monospace;color:var(--ink); }
.ws-icard__label { font-size:var(--t-label);color:var(--sub);margin-top:4px; }
.ws-icard__sub   { font-size:var(--t-label);color:var(--dim);margin-top:2px; }
.ws-icard__title { font-size:var(--t-label);font-weight:var(--w-bold);color:var(--sub);margin-bottom:8px;letter-spacing:var(--ls-label);text-transform:uppercase; }

.ws-achart { display:block; }

.ws-donut { display:flex;flex-direction:column;align-items:center;gap:8px; }
.ws-donut__legend { width:100%;display:flex;flex-direction:column;gap:4px; }
.ws-donut__item   { display:flex;align-items:center;gap:5px; }
.ws-donut__dot    { width:6px;height:6px;border-radius:50%;flex-shrink:0; }
.ws-donut__lbl    { font-size:var(--t-label);color:var(--sub);flex:1; }
.ws-donut__val    { font-size:var(--t-label);font-weight:var(--w-bold);color:var(--ink);font-family:"SF Mono","JetBrains Mono",monospace; }

@media (max-width: 820px) {
  .ws-body { grid-template-columns:1fr; }
  .ws-ind  { display:none; }
}
`;

// ─── Story ──────────────────────────────────────────────────────────────────

const meta = {
  title: "Prototypes/StateStream",
  component: StateStream,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof StateStream>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Concept: Story = {};
