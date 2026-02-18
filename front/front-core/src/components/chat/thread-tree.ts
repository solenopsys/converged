import type { ThreadFlatNode, ThreadMessageBase } from "./types";

type TreeConfig<TMessage extends ThreadMessageBase> = {
  getParentId?: (message: TMessage) => string | undefined;
  getTimestamp?: (message: TMessage) => number | undefined;
};

const ROOT = "__thread_root__";

function byTime<TMessage extends ThreadMessageBase>(
  left: ThreadFlatNode<TMessage>,
  right: ThreadFlatNode<TMessage>,
  getTimestamp: (message: TMessage) => number | undefined,
) {
  const l = getTimestamp(left.message) ?? 0;
  const r = getTimestamp(right.message) ?? 0;
  if (l !== r) return l - r;
  return left.index - right.index;
}

export function buildThreadTree<TMessage extends ThreadMessageBase>(
  messages: TMessage[],
  config: TreeConfig<TMessage> = {},
): ThreadFlatNode<TMessage>[] {
  const getParentId =
    config.getParentId ?? ((message: TMessage) => message.beforeId);
  const getTimestamp =
    config.getTimestamp ?? ((message: TMessage) => message.timestamp);

  const latestById = new Map<string, ThreadFlatNode<TMessage>>();
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const next: ThreadFlatNode<TMessage> = { message, depth: 0, index };
    const existing = latestById.get(message.id);
    if (!existing) {
      latestById.set(message.id, next);
      continue;
    }

    const existingTime = getTimestamp(existing.message) ?? 0;
    const nextTime = getTimestamp(message) ?? 0;
    if (nextTime >= existingTime) {
      latestById.set(message.id, next);
    }
  }

  const flat = Array.from(latestById.values());
  const ids = new Set(flat.map((item) => item.message.id));
  const children = new Map<string, ThreadFlatNode<TMessage>[]>();

  for (const item of flat) {
    const parentId = getParentId(item.message);
    const key = parentId && ids.has(parentId) ? parentId : ROOT;
    const bucket = children.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      children.set(key, [item]);
    }
  }

  for (const bucket of children.values()) {
    bucket.sort((left, right) => byTime(left, right, getTimestamp));
  }

  const result: ThreadFlatNode<TMessage>[] = [];
  const stack: Array<{ item: ThreadFlatNode<TMessage>; depth: number }> = [];
  const roots = [...(children.get(ROOT) ?? [])].reverse();

  for (const root of roots) {
    stack.push({ item: root, depth: 0 });
  }

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    result.push({ ...current.item, depth: current.depth });

    const next = children.get(current.item.message.id);
    if (!next || next.length === 0) continue;
    for (let idx = next.length - 1; idx >= 0; idx -= 1) {
      stack.push({ item: next[idx], depth: current.depth + 1 });
    }
  }

  return result;
}
