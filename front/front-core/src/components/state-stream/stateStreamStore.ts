import { createEvent, createStore } from "effector";

export type StreamEventTone = "neutral" | "attention" | "positive";

export type StreamEvent = {
  id: string;
  time: string;
  source: string;
  title: string;
  body: string;
  tone?: StreamEventTone;
  action?: string;
  actionId?: string;
};

export type StreamSignal = {
  key: string;
  label: string;
  value: string;
  detail: string;
  series: number[];
  tone?: StreamEventTone;
};

// Events
export const streamEventPushed = createEvent<StreamEvent>("STREAM_EVENT_PUSHED");
export const streamEventsReset = createEvent("STREAM_EVENTS_RESET");
export const streamSignalUpdated = createEvent<StreamSignal>("STREAM_SIGNAL_UPDATED");
export const streamSignalsReset = createEvent("STREAM_SIGNALS_RESET");

const MAX_EVENTS = 50;

// Stores
export const $streamEvents = createStore<StreamEvent[]>([])
  .on(streamEventPushed, (events, event) =>
    [event, ...events].slice(0, MAX_EVENTS),
  )
  .reset(streamEventsReset);

export const $streamSignals = createStore<StreamSignal[]>([])
  .on(streamSignalUpdated, (signals, next) => {
    const idx = signals.findIndex((s) => s.key === next.key);
    if (idx === -1) return [...signals, next];
    return signals.map((s) => (s.key === next.key ? next : s));
  })
  .reset(streamSignalsReset);
