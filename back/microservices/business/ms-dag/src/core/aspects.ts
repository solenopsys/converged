import { JSONPath } from "jsonpath-plus";
import type { StoreExecutionContext } from "./context";
import type { WorkflowRuntime } from "./runtime";

export type InputsAspect = {
  type: "inputs";
  inputs?: Record<string, string>;
  consts?: Record<string, any>;
};

export type FilterAspect = {
  type: "filter";
  when: string;
  source?: "context" | "data";
};

export type TransformAspect = {
  type: "transform";
  map: Record<string, string>;
  source?: "context" | "data";
};

export type MapAspect = {
  type: "map";
  path: string;
  concurrency?: number;
};

export type AspectDefinition = InputsAspect | FilterAspect | TransformAspect | MapAspect;

export type AspectRunResult<T> = {
  skipped: boolean;
  input: any;
  output: T | T[] | null;
};

const DEFAULT_CONCURRENCY = 8;

const getByPath = (data: any, path: string) => {
  if (!path) return undefined;
  if (path.startsWith("$")) {
    try {
      const result = JSONPath({ path, json: data });
      return Array.isArray(result) ? result[0] : result;
    } catch {
      return undefined;
    }
  }
  const parts = path.split(".");
  let current = data;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
};

const resolveInputs = (
  ctx: StoreExecutionContext,
  inputs?: Record<string, string>,
  consts?: Record<string, any>,
  dataContext?: any,
) => {
  const result: Record<string, any> = {};
  if (inputs) {
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === "string" && value.startsWith("$")) {
        const target = dataContext ?? ctx.context;
        result[key] = getByPath(target, value);
      } else {
        result[key] = value;
      }
    }
  }
  if (consts) {
    Object.assign(result, consts);
  }
  return result;
};

const resolveMap = (data: any, map: Record<string, string>, source: "context" | "data", ctx: StoreExecutionContext) => {
  const target = source === "context" ? ctx.context : data;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(map)) {
    result[key] = getByPath(target, value);
  }
  return result;
};

const runWithConcurrency = async <T,>(
  items: any[],
  limit: number,
  worker: (item: any) => Promise<T>,
): Promise<T[]> => {
  const results: T[] = [];
  let index = 0;

  const run = async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(workers);
  return results;
};

export async function runAspects<T>(
  ctx: StoreExecutionContext,
  runtime: WorkflowRuntime,
  aspects: AspectDefinition[],
  execute: (input: any) => Promise<T>,
  initialInput: any = {},
  options: { dataContext?: any; logContextKey?: string } = {},
): Promise<AspectRunResult<T>> {
  let data: any = initialInput ?? {};
  let mapAspect: MapAspect | null = null;
  const dataContext = options.dataContext;
  const logContextKey = options.logContextKey ?? ctx.contextKey;

  for (const aspect of aspects) {
    const aspectId = runtime.logAspectStart(logContextKey, aspect.type, {
      input: data,
      aspect,
    });

    try {
      if (aspect.type === "inputs") {
        data = resolveInputs(ctx, aspect.inputs, aspect.consts, dataContext);
      }

      if (aspect.type === "filter") {
        const source = aspect.source ?? "context";
        const target = source === "context" ? (dataContext ?? ctx.context) : data;
        const value = getByPath(target, aspect.when);
        if (!value) {
          runtime.logAspectEnd(logContextKey, aspectId, aspect.type, { skipped: true });
          return { skipped: true, input: data, output: null };
        }
      }

      if (aspect.type === "transform") {
        const source = aspect.source ?? "data";
        const contextSource = dataContext ?? ctx.context;
        data = resolveMap(data, aspect.map, source, { ...ctx, context: contextSource } as StoreExecutionContext);
      }

      if (aspect.type === "map") {
        mapAspect = aspect;
      }

      runtime.logAspectEnd(logContextKey, aspectId, aspect.type, { output: data });
    } catch (error) {
      runtime.logAspectError(
        logContextKey,
        aspectId,
        aspect.type,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  const execAspectId = runtime.logAspectStart(logContextKey, "execute", { input: data });
  try {
    let output: any;
    if (mapAspect) {
      const items = getByPath(data, mapAspect.path) ?? [];
      const concurrency = mapAspect.concurrency ?? DEFAULT_CONCURRENCY;
      output = await runWithConcurrency(items, concurrency, async (item) => execute({ ...data, item }));
    } else {
      output = await execute(data);
    }
    runtime.logAspectEnd(logContextKey, execAspectId, "execute", { output });
    return { skipped: false, input: data, output };
  } catch (error) {
    runtime.logAspectError(
      logContextKey,
      execAspectId,
      "execute",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
