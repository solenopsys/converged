import type { V2DiagramData, V2MachineStep } from "./types";

type Runtime = {
  config: V2DiagramData;
  root: HTMLElement;
  startedAt: number;
  cycle: number;
  row: number;
  rowHeight: number;
  active: boolean;
  streamId: string | null;
  stepRanges: Array<{ end: number; start: number; step: V2MachineStep }>;
};

let didInitialize = false;

function readConfigs() {
  return [...document.querySelectorAll<HTMLScriptElement>("script[data-v2-diagram-config]")]
    .map((script) => {
      if (!script.textContent) return null;
      return JSON.parse(script.textContent) as V2DiagramData;
    })
    .filter((config): config is V2DiagramData => Boolean(config?.machine));
}

function validateMachine(config: V2DiagramData) {
  const machine = config.machine;
  if (!machine) return;

  const symbolIds = new Set(config.symbols.map((symbol) => symbol.id));
  const connectionIds = new Set(config.connections.map((connection) => connection.id));

  for (const step of machine.steps) {
    if (step.event === "select") {
      const stream = config.symbols.find((symbol) => symbol.id === step.stream);
      if (!stream) throw new Error(`${config.id}: select references unknown stream "${step.stream}"`);
      if (!stream.rows?.length) throw new Error(`${config.id}: stream "${step.stream}" has no rows`);
    }

    if (step.event === "send") {
      if (!step.connections.length) throw new Error(`${config.id}: send step has empty connections`);
      for (const id of step.connections) {
        if (!connectionIds.has(id)) throw new Error(`${config.id}: send references unknown connection "${id}"`);
      }
    }

    if (step.event === "process" && !symbolIds.has(step.node)) {
      throw new Error(`${config.id}: process references unknown node "${step.node}"`);
    }
  }
}

function setupRuntime(config: V2DiagramData): Runtime | null {
  const root = document.querySelector<HTMLElement>(`.v2-diagram[data-v2-diagram-id="${config.id}"]`);
  const machine = config.machine;

  if (!root || !machine) return null;

  validateMachine(config);

  const cycle = machine.steps.reduce((sum, step) => sum + step.duration, 0);
  const streamId = machine.steps.find((step) => step.event === "select")?.stream ?? null;
  let cursor = 0;
  const stepRanges = machine.steps.map((step) => {
    const start = cursor;
    cursor += step.duration;
    return { end: cursor, start, step };
  });

  root.classList.add("v2-machine-ready");

  return {
    config,
    cycle,
    root,
    row: 0,
    rowHeight: machine.rowHeight,
    active: false,
    startedAt: performance.now(),
    streamId,
    stepRanges,
  };
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function rowCount(runtime: Runtime) {
  return runtime.config.symbols.find((symbol) => symbol.id === runtime.streamId)?.rows?.length ?? 1;
}

function setStream(runtime: Runtime, mode: "idle" | "scroll" | "focused", progress = 1) {
  if (!runtime.streamId) return;

  const stream = runtime.root.querySelector<HTMLElement>(`[data-v2-symbol-id="${runtime.streamId}"]`);
  const rows = runtime.config.symbols.find((symbol) => symbol.id === runtime.streamId)?.rows;
  const count = rows?.length ?? 1;

  if (!stream) return;

  const previousRow = runtime.row % count;
  const nextRow = (runtime.row + 1) % count;
  const targetDisplayRow = previousRow === count - 1 ? count : nextRow;
  const focusOffsetRows = 2;
  const displayRow =
    mode === "scroll"
      ? previousRow + (targetDisplayRow - previousRow) * easeInOutCubic(progress) - focusOffsetRows
      : mode === "focused"
        ? targetDisplayRow - focusOffsetRows
        : previousRow - focusOffsetRows;
  const focusedOrdinal = previousRow === count - 1 ? count : nextRow;

  stream.style.setProperty("--v2-stream-y", `${displayRow * -runtime.rowHeight}px`);
  stream.classList.toggle("is-scrolling", mode === "scroll");
  stream.classList.toggle("is-focused", mode === "focused");
  stream.querySelectorAll<HTMLElement>("[data-v2-row-index]").forEach((row) => {
    row.classList.toggle("is-active", mode === "focused" && Number(row.dataset.v2RowOrdinal) === focusedOrdinal);
  });
}

function pointOnPath(path: SVGPathElement, progress: number) {
  const length = path.getTotalLength();
  return path.getPointAtLength(length * Math.max(0, Math.min(1, progress)));
}

function resetMessages(runtime: Runtime) {
  runtime.root.querySelectorAll<SVGGElement>(".v2-edge-message").forEach((message) => {
    message.style.opacity = "0";
  });
}

function resetProcessors(runtime: Runtime) {
  runtime.root.querySelectorAll<HTMLElement>(".v2-symbol.is-processing").forEach((symbol) => {
    symbol.classList.remove("is-processing");
    symbol.style.setProperty("--v2-gear-rotation", "0deg");
  });
}

function moveConnectionMessage(runtime: Runtime, connectionId: string, progress: number, reverse = false) {
  const connection = runtime.root.querySelector<SVGGElement>(`[data-v2-connection-id="${connectionId}"]`);
  const path = connection?.querySelector<SVGPathElement>(".v2-connection-path");
  const message = connection?.querySelector<SVGGElement>(".v2-edge-message");

  if (!path || !message) return;

  const config = runtime.config.connections.find((candidate) => candidate.id === connectionId);
  const text = message.querySelector("text");
  if (text && config?.message) {
    const title = reverse && config.message.reply ? config.message.reply : config.message.title;
    if (text.textContent !== title) text.textContent = title;
  }

  const point = pointOnPath(path, reverse ? 1 - progress : progress);
  message.style.opacity = "1";
  message.setAttribute("transform", `translate(${point.x} ${point.y})`);
}

function setProcessor(runtime: Runtime, nodeId: string, progress: number) {
  const node = runtime.root.querySelector<HTMLElement>(`[data-v2-symbol-id="${nodeId}"]`);
  if (!node) return;

  node.classList.add("is-processing");
  node.style.setProperty("--v2-gear-rotation", `${progress * 240}deg`);
}

function runStep(runtime: Runtime, step: V2MachineStep, progress: number) {
  if (step.event === "select") {
    setStream(runtime, "scroll", progress);
    return;
  }

  setStream(runtime, "focused");

  if (step.event === "send") {
    const stagger = step.stagger ?? 0;
    const span = (step.connections.length - 1) * stagger + 1;
    step.connections.forEach((connectionId, index) => {
      const local = progress * span - index * stagger;
      if (local <= 0 || local > 1) return;
      moveConnectionMessage(runtime, connectionId, local, step.reverse);
    });
    return;
  }

  if (step.event === "process") {
    setProcessor(runtime, step.node, progress);
  }
}

function tick(runtime: Runtime, now: number) {
  const elapsed = now - runtime.startedAt;
  const cycleTime = elapsed % runtime.cycle;
  const cycleIndex = Math.floor(elapsed / runtime.cycle);
  runtime.row = cycleIndex % rowCount(runtime);

  const range = runtime.stepRanges.find((candidate) => cycleTime >= candidate.start && cycleTime < candidate.end) ?? runtime.stepRanges[0];
  const progress = (cycleTime - range.start) / (range.end - range.start);

  resetMessages(runtime);
  resetProcessors(runtime);
  runStep(runtime, range.step, progress);
}

export function initDiagramRuntime() {
  if (didInitialize) return;
  didInitialize = true;

  const runtimes = readConfigs().map(setupRuntime).filter((runtime): runtime is Runtime => Boolean(runtime));

  function resetVisuals(runtime: Runtime) {
    resetMessages(runtime);
    resetProcessors(runtime);
    setStream(runtime, "idle");
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const runtime = runtimes.find((candidate) => candidate.root === entry.target);
        if (!runtime) continue;

        const active = entry.intersectionRatio >= 0.5;
        if (active && !runtime.active) runtime.startedAt = performance.now();
        if (!active && runtime.active) resetVisuals(runtime);
        runtime.active = active;
      }
    },
    { threshold: [0, 0.5] },
  );

  runtimes.forEach((runtime) => observer.observe(runtime.root));

  function frame(now: number) {
    runtimes.forEach((runtime) => {
      if (runtime.active) tick(runtime, now);
    });
    requestAnimationFrame(frame);
  }

  if (runtimes.length) {
    requestAnimationFrame(frame);
  }
}
