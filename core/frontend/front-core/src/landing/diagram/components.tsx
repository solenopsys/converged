import type { ComponentChildren } from "preact";
import type { CSSProperties } from "preact/compat";
import { useEffect, useState } from "preact/hooks";
import { getStreamlineIcon, streamlineCogIcon, streamlineIconByKind } from "./icons";
import { mergeDiagram } from "./merge";
import {
  V2_GRID_SIZE,
  type V2Anchor,
  type V2DiagramConfig,
  type V2DiagramData,
  type V2DiagramTexts,
  type V2GridRect,
  type V2RenderedConnection,
  type V2RenderedGroup,
  type V2RenderedSymbol,
} from "./types";

function gridStyle(rect: V2GridRect): CSSProperties {
  return {
    "--v2-x": rect.x,
    "--v2-y": rect.y,
    "--v2-w": rect.w,
    "--v2-h": rect.h,
  } as CSSProperties;
}

function symbolStyle(symbol: V2RenderedSymbol): CSSProperties {
  return {
    ...gridStyle(symbol.rect),
    "--v2-row-count": symbol.rows?.length ?? 0,
  } as CSSProperties;
}

function SymbolRows({ duplicate = false, rows }: { duplicate?: boolean; rows?: string[] }) {
  if (!rows?.length) return null;
  const renderedRows = duplicate ? [...rows, ...rows] : rows;

  return (
    <div className="v2-symbol-rows">
      <div className="v2-symbol-row-track">
        {renderedRows.map((row, index) => (
          <span data-v2-row-index={index % rows.length} data-v2-row-ordinal={index} key={`${row}-${index}`}>
            {row}
          </span>
        ))}
      </div>
    </div>
  );
}

export function V2StreamlineIcon({ icon }: { icon: string }) {
  const data = getStreamlineIcon(icon);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${data.width} ${data.height}`}
      dangerouslySetInnerHTML={{ __html: data.body }}
    />
  );
}

export function V2GroupNode({ group }: { group: V2RenderedGroup }) {
  return (
    <div className={`v2-group tone-${group.tone ?? "default"}`} data-v2-group-id={group.id} style={gridStyle(group.rect)}>
      <span className="v2-group-title">
        <strong>{group.title}</strong>
        {group.subtitle ? <small>{group.subtitle}</small> : null}
      </span>
    </div>
  );
}
export function V2SymbolNode({ symbol }: { symbol: V2RenderedSymbol }) {
  const icon = symbol.icon ?? streamlineIconByKind[symbol.kind];

  return (
    <article
      className={`v2-symbol v2-${symbol.kind} tone-${symbol.tone ?? "default"}`}
      data-v2-symbol-id={symbol.id}
      style={symbolStyle(symbol)}
    >
      <div className="v2-symbol-icon">
        <V2StreamlineIcon icon={icon} />
      </div>
      <div className="v2-symbol-copy">
        <strong>{symbol.title}</strong>
        {symbol.subtitle ? <small>{symbol.subtitle}</small> : null}
      </div>
      {symbol.kind === "processor" ? (
        <div className="v2-processor-gear">
          <V2StreamlineIcon icon={streamlineCogIcon} />
        </div>
      ) : null}
      <SymbolRows duplicate={symbol.kind === "stream"} rows={symbol.rows} />
    </article>
  );
}

export function V2Stage({
  children,
  className,
  diagramId,
  height = 44,
  width = 72,
}: {
  children: ComponentChildren;
  className?: string;
  diagramId?: string;
  height?: number;
  width?: number;
}) {
  return (
    <section
      className={`v2-stage${className ? ` ${className}` : ""}`}
      data-v2-diagram-id={diagramId}
      style={
        {
          "--v2-grid": `${V2_GRID_SIZE}px`,
          "--v2-stage-w": width,
          "--v2-stage-h": height,
        } as CSSProperties
      }
    >
      {children}
    </section>
  );
}

function anchorPoint(rect: V2GridRect, anchor: V2Anchor, offset = 0) {
  const x = rect.x;
  const y = rect.y;
  const w = rect.w;
  const h = rect.h;

  if (anchor === "top") return { x: x + w / 2 + offset, y };
  if (anchor === "right") return { x: x + w, y: y + h / 2 + offset };
  if (anchor === "bottom") return { x: x + w / 2 + offset, y: y + h };
  if (anchor === "left") return { x, y: y + h / 2 + offset };
  return { x: x + w / 2, y: y + h / 2 };
}

function roundedOrthogonalPath(points: Array<{ x: number; y: number }>, radius = 1.2) {
  if (points.length < 2) return "";

  const commands = [`M ${points[0].x} ${points[0].y}`];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const inLength = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    const outLength = Math.abs(next.x - current.x) + Math.abs(next.y - current.y);
    const curve = Math.min(radius, inLength / 2, outLength / 2);
    const before = {
      x: current.x + Math.sign(previous.x - current.x) * curve,
      y: current.y + Math.sign(previous.y - current.y) * curve,
    };
    const after = {
      x: current.x + Math.sign(next.x - current.x) * curve,
      y: current.y + Math.sign(next.y - current.y) * curve,
    };

    commands.push(`L ${before.x} ${before.y}`);
    commands.push(`Q ${current.x} ${current.y} ${after.x} ${after.y}`);
  }

  const last = points.at(-1);
  if (last) commands.push(`L ${last.x} ${last.y}`);

  return commands.join(" ");
}

function orthogonalPoints(points: Array<{ x: number; y: number }>, startsHorizontal: boolean, endsHorizontal: boolean) {
  const result = [points[0]];
  let horizontal = startsHorizontal;

  for (let index = 1; index < points.length; index += 1) {
    const previous = result[result.length - 1];
    const target = points[index];

    if (previous.x !== target.x && previous.y !== target.y) {
      const last = index === points.length - 1;
      const elbowHorizontalFirst = last ? !endsHorizontal : horizontal;
      result.push(elbowHorizontalFirst ? { x: target.x, y: previous.y } : { x: previous.x, y: target.y });
    }

    const elbow = result[result.length - 1];
    result.push(target);
    horizontal = target.y === elbow.y;
  }

  return result;
}

function connectionPath(connection: V2RenderedConnection, symbols: Map<string, V2RenderedSymbol>) {
  const from = symbols.get(connection.from);
  const to = symbols.get(connection.to);

  if (!from || !to) {
    throw new Error(`Unknown v2 connection endpoint: ${connection.id}`);
  }

  const start = anchorPoint(from.rect, connection.fromAnchor, connection.fromOffset);
  const end = anchorPoint(to.rect, connection.toAnchor, connection.toOffset);

  if (connection.via?.length) {
    const startsHorizontal = connection.fromAnchor === "left" || connection.fromAnchor === "right";
    const endsHorizontal = connection.toAnchor === "left" || connection.toAnchor === "right";
    return roundedOrthogonalPath(orthogonalPoints([start, ...connection.via, end], startsHorizontal, endsHorizontal));
  }

  if (start.x === end.x || start.y === end.y) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  if (connection.fromAnchor === "right" || connection.fromAnchor === "left") {
    const midX = (start.x + end.x) / 2;
    return roundedOrthogonalPath([start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]);
  }

  const midY = (start.y + end.y) / 2;
  return roundedOrthogonalPath([start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]);
}

function V2ConnectionLayer({ diagram }: { diagram: V2DiagramData }) {
  const symbols = new Map(diagram.symbols.map((symbol) => [symbol.id, symbol]));

  return (
    <svg className="v2-connections" viewBox={`0 0 ${diagram.width} ${diagram.height}`} aria-hidden="true">
      <defs>
        <marker
          id={`${diagram.id}-arrow`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
      {diagram.connections.map((connection) => {
        const path = connectionPath(connection, symbols);
        const label = [connection.message?.title, connection.message?.reply]
          .filter((value): value is string => typeof value === "string" && value.length > 0)
          .sort((a, b) => b.length - a.length)[0];
        // Monospace advance ~0.66em at 1.45px font + minimal side padding (~2px on screen).
        const labelWidth = label ? label.length * 0.95 + 0.7 : 0;

        return (
          <g className={`v2-connection tone-${connection.tone ?? "default"}`} data-v2-connection-id={connection.id} key={connection.id}>
            <path
              id={`${diagram.id}-${connection.id}`}
              className="v2-connection-path"
              d={path}
              markerEnd={`url(#${diagram.id}-arrow)`}
              markerStart={connection.bidirectional ? `url(#${diagram.id}-arrow)` : undefined}
            />
            {connection.message ? (
              <g className="v2-edge-message">
                <rect x={-labelWidth / 2} y={-1.2} width={labelWidth} height={2.4} rx={1.0} />
                <text y={0.5}>{connection.message.title}</text>
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function V2Diagram({
  config,
  texts,
  className,
  verticalOnMobile = false,
}: {
  config: V2DiagramConfig;
  texts: V2DiagramTexts | undefined;
  className?: string;
  verticalOnMobile?: boolean;
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const section = document.querySelector<HTMLElement>(".product-case-scroll");
    if (!section) {
      const media = window.matchMedia("(max-width: 900px)");
      const update = () => setIsMobile(media.matches);
      update();
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    const update = () => setIsMobile(section.clientWidth <= 900);
    const observer = new ResizeObserver(update);
    observer.observe(section);
    update();
    return () => observer.disconnect();
  }, []);

  const diagram = mergeDiagram(config, texts);
  const renderedDiagram = verticalOnMobile && isMobile ? verticalizeDiagram(diagram) : diagram;

  return (
    <V2Stage
      className={`v2-diagram${className ? ` ${className}` : ""}`}
      diagramId={renderedDiagram.id}
      height={renderedDiagram.height}
      width={renderedDiagram.width}
    >
      {renderedDiagram.machine ? (
        <script
          type="application/json"
          data-v2-diagram-config={renderedDiagram.id}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(renderedDiagram) }}
        />
      ) : null}
      <V2ConnectionLayer diagram={renderedDiagram} />
      {renderedDiagram.groups?.map((group) => (
        <V2GroupNode key={group.id} group={group} />
      ))}
      {renderedDiagram.symbols.map((symbol) => (
        <V2SymbolNode key={symbol.id} symbol={symbol} />
      ))}
    </V2Stage>
  );
}

function verticalizeDiagram(diagram: V2DiagramData): V2DiagramData {
  const width = diagram.height + 16;
  const columns = new Map<number, typeof diagram.symbols>();
  for (const symbol of diagram.symbols) {
    const column = columns.get(symbol.rect.x) ?? [];
    column.push(symbol);
    columns.set(symbol.rect.x, column);
  }

  const placed = new Map<string, V2RenderedSymbol>();
  let y = 2;
  for (const column of [...columns.values()].sort((a, b) => a[0].rect.x - b[0].rect.x)) {
    const nodes = [...column].sort((a, b) => a.rect.y - b.rect.y);
    const nodeWidth = Math.max(...nodes.map((node) => Math.max(node.rect.w, 22)));
    const gap = 4;
    const rowWidth = nodes.length * nodeWidth + (nodes.length - 1) * gap;
    const shouldGrid = nodes.length === 4 && rowWidth > width - 4;
    const shouldStack = rowWidth > width - 4 && !shouldGrid;
    let x = shouldStack ? (width - nodeWidth) / 2 : shouldGrid ? (width - (nodeWidth * 2 + gap)) / 2 : (width - rowWidth) / 2;
    let columnHeight = 0;

    for (const [index, node] of nodes.entries()) {
      const rect = {
        ...node.rect,
        w: Math.max(node.rect.w, 22),
        x: shouldGrid ? x + (index % 2) * (nodeWidth + gap) : x,
        y:
          y + (shouldStack ? columnHeight : shouldGrid ? Math.floor(index / 2) * (Math.max(...nodes.map((item) => item.rect.h)) + gap) : 0),
      };
      placed.set(node.id, { ...node, rect });
      columnHeight = shouldStack
        ? columnHeight + node.rect.h + gap
        : shouldGrid
          ? Math.max(columnHeight, Math.ceil(nodes.length / 2) * (Math.max(...nodes.map((item) => item.rect.h)) + gap) - gap)
          : Math.max(columnHeight, node.rect.h);
      if (!shouldStack && !shouldGrid) x += nodeWidth + gap;
    }

    y += columnHeight + 14;
  }

  const symbols = diagram.symbols.map((symbol) => placed.get(symbol.id) ?? symbol);
  const groups = diagram.groups?.map((group) => {
    const members = symbols.filter((symbol) => {
      const original = diagram.symbols.find((candidate) => candidate.id === symbol.id);
      return (
        original &&
        original.rect.x >= group.rect.x &&
        original.rect.y >= group.rect.y &&
        original.rect.x + original.rect.w <= group.rect.x + group.rect.w &&
        original.rect.y + original.rect.h <= group.rect.y + group.rect.h
      );
    });
    if (!members.length) return group;
    const left = Math.min(...members.map((symbol) => symbol.rect.x)) - 2;
    const top = Math.min(...members.map((symbol) => symbol.rect.y)) - 2;
    const right = Math.max(...members.map((symbol) => symbol.rect.x + symbol.rect.w)) + 2;
    const bottom = Math.max(...members.map((symbol) => symbol.rect.y + symbol.rect.h)) + 2;
    return { ...group, rect: { x: left, y: top, w: right - left, h: bottom - top } };
  });
  const byId = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  const incomingCount = new Map<string, number>();
  for (const connection of diagram.connections) {
    incomingCount.set(connection.to, (incomingCount.get(connection.to) ?? 0) + 1);
  }
  const connections = diagram.connections.map((connection): V2RenderedConnection => {
    const from = byId.get(connection.from);
    const to = byId.get(connection.to);
    if (!from || !to) {
      throw new Error(`Unknown vertical v2 connection endpoint: ${connection.id}`);
    }
    const dx = to.rect.x + to.rect.w / 2 - (from.rect.x + from.rect.w / 2);
    const dy = to.rect.y + to.rect.h / 2 - (from.rect.y + from.rect.h / 2);
    const vertical = Math.abs(dy) >= Math.abs(dx);
    const incoming = diagram.connections
      .filter((candidate) => candidate.to === connection.to)
      .sort((a, b) => {
        const left = byId.get(a.from);
        const right = byId.get(b.from);
        return (left?.rect.x ?? 0) - (right?.rect.x ?? 0) || (left?.rect.y ?? 0) - (right?.rect.y ?? 0);
      });
    const connectionIndex = incoming.findIndex((candidate) => candidate.id === connection.id);
    return {
      ...connection,
      fromAnchor: vertical ? (dy >= 0 ? "bottom" : "top") : dx >= 0 ? "right" : "left",
      toAnchor: vertical ? (dy >= 0 ? "top" : "bottom") : dx >= 0 ? "left" : "right",
      toOffset: (incomingCount.get(connection.to) ?? 0) > 1 ? (connectionIndex - (incoming.length - 1) / 2) * 3 : connection.toOffset,
      via: undefined,
    };
  });

  return { ...diagram, width, height: y, symbols, groups, connections };
}
