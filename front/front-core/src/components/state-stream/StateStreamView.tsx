"use client";

import { useUnit } from "effector-react";
import { ArrowUpRight, Gauge } from "lucide-react";
import { Button, Card, CardContent, CardHeader, ScrollArea } from "../ui";
import {
  $streamEvents,
  $streamSignals,
  type StreamEvent,
  type StreamSignal,
} from "./stateStreamStore";


// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values, tone = "neutral" }: { values: number[]; tone?: string }) {
  if (values.length < 2) return null;
  const width = 132;
  const height = 42;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 6) - 3,
  }));
  const path = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    const prev = points[i - 1];
    const cx = ((prev.x + p.x) / 2).toFixed(1);
    return `${acc} C ${cx} ${prev.y.toFixed(1)} ${cx} ${p.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }, "");
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg className="ss-sparkline" data-tone={tone} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={area} className="ss-sparkline__area" />
      <path d={path} className="ss-sparkline__line" />
    </svg>
  );
}

// ── Stream event row ──────────────────────────────────────────────────────────

function StreamEventRow({ item }: { item: StreamEvent }) {
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
      </div>
    </article>
  );
}

// ── Signal card ───────────────────────────────────────────────────────────────

function SignalCard({ signal }: { signal: StreamSignal }) {
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

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyEvents() {
  return (
    <div style={{ padding: "32px 0", textAlign: "center", color: "var(--ui-muted-foreground)", fontSize: "14px" }}>
      <p style={{ margin: 0 }}>No events yet</p>
      <p style={{ margin: "6px 0 0", fontSize: "13px", opacity: 0.7 }}>Events will appear here as they happen</p>
    </div>
  );
}

function EmptySignals() {
  return (
    <div style={{ padding: "24px 14px", color: "var(--ui-muted-foreground)", fontSize: "13px", textAlign: "center" }}>
      No indicators available
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function StateStreamView() {
  const events = useUnit($streamEvents);
  const signals = useUnit($streamSignals);

  return (
    <main className="ss">
      <style>{css}</style>

      <header className="ss-top">
        <div className="ss-title">
          <span className="ss-title__dot" aria-hidden="true" />
          <h1>State stream</h1>
        </div>
        <p>Live flows: what happened, and what the system state looks like now.</p>
      </header>

      <div className="ss-grid">
        <section className="ss-events" aria-label="Events">
          <div className="ss-col-head">
            <h2>Events</h2>
            <span>latest first</span>
          </div>
          <ScrollArea className="ss-scroll">
            {events.length === 0 ? (
              <EmptyEvents />
            ) : (
              events.map((item) => <StreamEventRow item={item} key={item.id} />)
            )}
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
            {signals.length === 0 ? (
              <EmptySignals />
            ) : (
              <div className="ss-signal-list">
                {signals.map((signal) => (
                  <SignalCard key={signal.key} signal={signal} />
                ))}
              </div>
            )}
          </ScrollArea>
        </aside>
      </div>
    </main>
  );
}

const css = `
.ss {
  height: 100%;
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
  background: var(--ui-chart-2);
  animation: ss-pulse 2s ease-in-out infinite;
}

@keyframes ss-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
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
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
}

.ss-events, .ss-rail {
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
}

.ss-scroll { min-height: 0; }

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

.ss-col-head span, .ss-col-head p {
  margin: 0;
  color: var(--ui-muted-foreground);
  font-size: 13px;
  font-weight: 500;
}

.ss-col-head svg { color: var(--ui-muted-foreground); }

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
  font-size: clamp(18px, 1.6vw, 24px);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.ss-event p {
  max-width: 760px;
  margin: 0;
  color: var(--ui-muted-foreground);
  font-size: 14px;
  line-height: 1.42;
}

.ss-event[data-tone="attention"] h2 { color: var(--ui-chart-4); }
.ss-event[data-tone="positive"] h2  { color: var(--ui-chart-2); }

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

.ss-signal__inner {
  display: grid;
  grid-template-columns: 1fr;
  align-content: space-between;
  gap: 12px;
  min-height: 140px;
  padding: 14px;
}

.ss-signal:first-child .ss-signal__inner {
  grid-template-columns: minmax(0, 0.7fr) minmax(130px, 1fr);
  align-items: end;
  min-height: 156px;
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
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -0.05em;
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

.ss-sparkline { width: 100%; height: 52px; overflow: visible; }
.ss-signal:first-child .ss-sparkline { height: 70px; }
.ss-sparkline__area { fill: color-mix(in oklch, var(--ui-muted-foreground) 12%, transparent); }
.ss-sparkline__line { fill: none; stroke: var(--ui-muted-foreground); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
.ss-sparkline[data-tone="attention"] .ss-sparkline__area { fill: color-mix(in oklch, var(--ui-chart-4) 14%, transparent); }
.ss-sparkline[data-tone="attention"] .ss-sparkline__line { stroke: var(--ui-chart-4); }
.ss-sparkline[data-tone="positive"]  .ss-sparkline__area { fill: color-mix(in oklch, var(--ui-chart-2) 14%, transparent); }
.ss-sparkline[data-tone="positive"]  .ss-sparkline__line { stroke: var(--ui-chart-2); }

@media (max-width: 1040px) {
  .ss { padding: 16px; }
  .ss-top, .ss-grid { grid-template-columns: 1fr; }
  .ss-title h1 { font-size: clamp(42px, 10vw, 68px); }
  .ss-rail { border-left: 0; padding-left: 0; }
  .ss-signal-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
