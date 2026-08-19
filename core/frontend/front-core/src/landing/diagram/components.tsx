import type { ComponentChildren } from "preact";
import type { CSSProperties } from "preact/compat";
import { getStreamlineIcon, streamlineCogIcon, streamlineIconByKind } from "./icons";
import {
  V2_GRID_SIZE,
  type V2Anchor,
  type V2Connection,
  type V2DiagramData,
  type V2GridRect,
  type V2Symbol,
} from "./types";

function gridStyle(rect: V2GridRect): CSSProperties {
  return {
    "--v2-x": rect.x,
    "--v2-y": rect.y,
    "--v2-w": rect.w,
    "--v2-h": rect.h,
  } as CSSProperties;
}

function symbolStyle(symbol: V2Symbol): CSSProperties {
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

export function V2SymbolNode({ symbol }: { symbol: V2Symbol }) {
  const icon = symbol.icon ?? streamlineIconByKind[symbol.kind];

  return (
    <article className={`v2-symbol v2-${symbol.kind} tone-${symbol.tone ?? "default"}`} data-v2-symbol-id={symbol.id} style={symbolStyle(symbol)}>
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

function roundedOrthogonalPath(points: Array<{ x: number; y: number }>, radius = 2.2) {
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

function connectionPath(connection: V2Connection, symbols: Map<string, V2Symbol>) {
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
    return roundedOrthogonalPath([
      start,
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      end,
    ]);
  }

  const midY = (start.y + end.y) / 2;
  return roundedOrthogonalPath([
    start,
    { x: start.x, y: midY },
    { x: end.x, y: midY },
    end,
  ]);
}

function V2ConnectionLayer({ diagram }: { diagram: V2DiagramData }) {
  const symbols = new Map(diagram.symbols.map((symbol) => [symbol.id, symbol]));

  return (
    <svg className="v2-connections" viewBox={`0 0 ${diagram.width} ${diagram.height}`} aria-hidden="true">
      <defs>
        <marker id={`${diagram.id}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
      {diagram.connections.map((connection) => {
        const path = connectionPath(connection, symbols);

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
                <circle r="1.8" />
                <text y="0.38">{connection.message.title}</text>
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function V2Diagram({ diagram, className }: { diagram: V2DiagramData; className?: string }) {
  return (
    <V2Stage className={`v2-diagram${className ? ` ${className}` : ""}`} diagramId={diagram.id} height={diagram.height} width={diagram.width}>
      {diagram.machine ? (
        <script
          type="application/json"
          data-v2-diagram-config={diagram.id}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(diagram) }}
        />
      ) : null}
      <V2ConnectionLayer diagram={diagram} />
      {diagram.symbols.map((symbol) => (
        <V2SymbolNode key={symbol.id} symbol={symbol} />
      ))}
    </V2Stage>
  );
}
