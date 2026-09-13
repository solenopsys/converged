/**
 * Applying a locale to a diagram config.
 *
 * Config and copy are stored apart — the config outside the locale tree, the
 * copy inside it — so a translator never sees a grid coordinate and a designer
 * never edits ten translated copies of the same layout. Rendering needs them
 * back together, and this is the only place that joins them.
 *
 * The join is by id, so a symbol whose copy is missing still renders, with an
 * empty title, rather than taking the diagram down. A diagram with no locale
 * entry at all is a different matter: that is a wiring mistake, and it throws.
 */

import type {
  V2DiagramConfig,
  V2DiagramData,
  V2DiagramTexts,
  V2RenderedConnection,
  V2RenderedGroup,
  V2RenderedSymbol,
} from "./types";

export function mergeDiagram(config: V2DiagramConfig, texts: V2DiagramTexts | undefined): V2DiagramData {
  if (!texts) {
    throw new Error(`[diagram] no locale texts for "${config.id}"`);
  }

  const symbols: V2RenderedSymbol[] = config.symbols.map((symbol) => {
    const copy = texts.symbols?.[symbol.id];
    return { ...symbol, title: copy?.title ?? "", subtitle: copy?.subtitle, rows: copy?.rows };
  });

  const groups: V2RenderedGroup[] | undefined = config.groups?.map((group) => {
    const copy = texts.groups?.[group.id];
    return { ...group, title: copy?.title ?? "", subtitle: copy?.subtitle };
  });

  const connections: V2RenderedConnection[] = config.connections.map((connection) => {
    const copy = texts.connections?.[connection.id];
    // An edge carries a travelling label only when the locale gives it one.
    const message = copy?.title ? { title: copy.title, reply: copy.reply } : undefined;
    return { ...connection, label: copy?.label, message };
  });

  return {
    id: config.id,
    title: texts.title ?? "",
    width: config.width,
    height: config.height,
    machine: config.machine,
    symbols,
    connections,
    groups,
  };
}
