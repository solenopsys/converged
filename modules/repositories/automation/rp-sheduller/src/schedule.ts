import { Cron } from "croner";
import type { CronEntry, ScheduledTopic } from "./types";

/**
 * Turning cron settings into instants.
 *
 * This is the only place in the platform that understands a cron expression.
 * The ticker that actually fires events lives in Fujin and deals in numbers, so
 * everything calendar-shaped — five-field syntax, time zones, the hour that
 * does not exist on a DST morning — is resolved here, by a library written for
 * it, and never travels further.
 */

/** Topic for a schedule that did not name one: `cron.<slugged name>`. */
export function defaultTopic(entry: CronEntry): string {
  const slug = entry.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `cron.${slug || entry.id}`;
}

/**
 * Occurrences of one entry inside `[from, from + horizonMs]`.
 *
 * A paused entry yields nothing, and so does one whose expression no longer
 * parses: an operator's typo must not take the whole plan down with it, and it
 * shows up as a schedule that stopped firing rather than as a ticker that
 * stopped ticking.
 */
export function occurrencesFor(
  entry: CronEntry,
  from: Date,
  horizonMs: number,
): number[] {
  if (entry.status === "paused") return [];

  let cron: Cron;
  try {
    cron = new Cron(entry.expression, entry.timezone ? { timezone: entry.timezone } : {});
  } catch (error) {
    console.warn(`[rp-sheduller] ${entry.name}: unusable expression`, error);
    return [];
  }

  const until = from.getTime() + horizonMs;
  const found: number[] = [];
  // Bounded: a per-second expression over a long horizon would otherwise
  // produce an unbounded list, and the ticker only needs the next few anyway.
  for (const run of cron.nextRuns(64, from)) {
    const at = run.getTime();
    if (at > until) break;
    found.push(at);
  }
  return found;
}

export function planFor(
  entries: CronEntry[],
  from: Date,
  horizonMs: number,
): ScheduledTopic[] {
  const items: ScheduledTopic[] = [];
  for (const entry of entries) {
    const occurrences = occurrencesFor(entry, from, horizonMs);
    if (occurrences.length === 0) continue;
    items.push({
      cronId: entry.id,
      name: entry.name,
      topic: entry.topic?.trim() || defaultTopic(entry),
      // `provider` and `action` are no longer instructions — a schedule emits an
      // event and subscribers decide. They ride along as metadata so an
      // existing configuration keeps meaning something to whoever reads it.
      payload: {
        cronId: entry.id,
        name: entry.name,
        expression: entry.expression,
        provider: entry.provider,
        action: entry.action,
        ...(entry.params ?? {}),
      },
      occurrences,
    });
  }
  return items;
}
