type BackendLogBridgeOptions = {
  serviceBaseUrl: string;
  source?: string;
  flushDebounceMs?: number;
  retryDelayMs?: number;
  maxBatchSize?: number;
  maxQueueSize?: number;
  dedupeWindowMs?: number;
};

const DEFAULT_SOURCE = "back.runtime";
const DEFAULT_DEBOUNCE_MS = 1200;
const DEFAULT_RETRY_MS = 5000;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_QUEUE_SIZE = 1000;
const DEFAULT_DEDUPE_MS = 5000;

const LEVEL_WARNING = 2;
const LEVEL_ERROR = 3;

const CODE_CONSOLE_ERROR = 2001;
const CODE_PROCESS_UNHANDLED_REJECTION = 2002;
const CODE_PROCESS_UNCAUGHT_EXCEPTION = 2003;
const CODE_HTTP_HANDLER_ERROR = 2004;
const CODE_DROPPED_EVENTS = 2099;

const MAX_MESSAGE_LENGTH = 6000;

type LogEventInput = {
  ts?: number;
  source: string;
  level: number;
  code: number;
  message: string;
};

function trimMessage(message: string): string {
  if (message.length <= MAX_MESSAGE_LENGTH) return message;
  return `${message.slice(0, MAX_MESSAGE_LENGTH)}…`;
}

function stringify(value: unknown): string {
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function installBackendLogBridge(options: BackendLogBridgeOptions) {
  const source = options.source ?? DEFAULT_SOURCE;
  const flushDebounceMs = options.flushDebounceMs ?? DEFAULT_DEBOUNCE_MS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_MS;
  const maxBatchSize = options.maxBatchSize ?? DEFAULT_BATCH_SIZE;
  const maxQueueSize = options.maxQueueSize ?? DEFAULT_QUEUE_SIZE;
  const dedupeWindowMs = options.dedupeWindowMs ?? DEFAULT_DEDUPE_MS;

  let queue: LogEventInput[] = [];
  let droppedCount = 0;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let flushInProgress = false;
  let internalSend = false;
  const dedupeMap = new Map<string, number>();

  const originalConsoleError = console.error.bind(console);

  const postEvent = async (event: LogEventInput) => {
    const token = process.env.SERVICE_TOKEN;
    await fetch(`${options.serviceBaseUrl}/logs/write`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ event }),
    });
  };

  const scheduleFlush = (delay = flushDebounceMs) => {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      void flushNow();
    }, delay);
  };

  const enqueue = (event: Omit<LogEventInput, "source"> & { source?: string }) => {
    const normalized: LogEventInput = {
      ts: event.ts ?? Date.now(),
      source: event.source ?? source,
      level: event.level,
      code: event.code,
      message: trimMessage(event.message || ""),
    };
    if (!normalized.message) return;

    const dedupeKey = `${normalized.level}:${normalized.code}:${normalized.message}`;
    const now = Date.now();
    const lastSeenAt = dedupeMap.get(dedupeKey);
    if (lastSeenAt && now - lastSeenAt < dedupeWindowMs) {
      return;
    }
    dedupeMap.set(dedupeKey, now);

    if (queue.length >= maxQueueSize) {
      droppedCount += 1;
      return;
    }

    queue.push(normalized);
    scheduleFlush();
  };

  const flushNow = async () => {
    if (flushInProgress || queue.length === 0) return;
    flushInProgress = true;

    try {
      if (droppedCount > 0) {
        queue.push({
          ts: Date.now(),
          source,
          level: LEVEL_WARNING,
          code: CODE_DROPPED_EVENTS,
          message: `Dropped ${droppedCount} backend log events due to queue overflow`,
        });
        droppedCount = 0;
      }

      while (queue.length > 0) {
        const batch = queue.splice(0, maxBatchSize);
        internalSend = true;
        try {
          await Promise.all(batch.map((event) => postEvent(event)));
        } catch {
          queue = [...batch, ...queue];
          scheduleFlush(retryDelayMs);
          break;
        } finally {
          internalSend = false;
        }
      }
    } finally {
      flushInProgress = false;
    }
  };

  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);
    if (internalSend) return;

    enqueue({
      level: LEVEL_ERROR,
      code: CODE_CONSOLE_ERROR,
      message: args.map((arg) => stringify(arg)).join(" | "),
    });
  };

  process.on("unhandledRejection", (reason) => {
    enqueue({
      level: LEVEL_ERROR,
      code: CODE_PROCESS_UNHANDLED_REJECTION,
      message: stringify(reason),
    });
  });

  process.on("uncaughtException", (error) => {
    enqueue({
      level: LEVEL_ERROR,
      code: CODE_PROCESS_UNCAUGHT_EXCEPTION,
      message: stringify(error),
    });
    void flushNow().finally(() => process.exit(1));
  });

  process.once("beforeExit", () => {
    void flushNow();
  });

  return {
    enqueue,
    flushNow,
    code: {
      httpHandlerError: CODE_HTTP_HANDLER_ERROR,
    },
    level: {
      warning: LEVEL_WARNING,
      error: LEVEL_ERROR,
    },
  };
}
