import { createLogsServiceClient } from "g-logs"

type BrowserErrorBridgeOptions = {
  source?: string
  flushDebounceMs?: number
  maxBatchSize?: number
  maxQueueSize?: number
}

const DEFAULT_SOURCE = "front.browser"
const DEFAULT_DEBOUNCE_MS = 1200
const DEFAULT_BATCH_SIZE = 20
const DEFAULT_QUEUE_SIZE = 300
const DEDUPE_WINDOW_MS = 5000
const MAX_MESSAGE_LENGTH = 4000
const INSTALLED_KEY = "__BROWSER_ERROR_BRIDGE_INSTALLED__"

const LEVEL_WARNING = 2
const LEVEL_ERROR = 3

const CODE_CONSOLE_ERROR = 1001
const CODE_WINDOW_ERROR = 1002
const CODE_UNHANDLED_REJECTION = 1003
const CODE_DROPPED_EVENTS = 1099

const logsClient = createLogsServiceClient({ baseUrl: "/services" })

function stringify(value: unknown): string {
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`
  }
  if (typeof value === "string") {
    return value
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function trimMessage(message: string): string {
  if (message.length <= MAX_MESSAGE_LENGTH) return message
  return `${message.slice(0, MAX_MESSAGE_LENGTH)}…`
}

function normalizeArgs(args: unknown[]): string {
  return trimMessage(args.map((arg) => stringify(arg)).join(" | "))
}

export function setupBrowserErrorBridge(options: BrowserErrorBridgeOptions = {}): void {
  if (typeof window === "undefined") return

  const win = window as Window & { [INSTALLED_KEY]?: boolean }
  if (win[INSTALLED_KEY]) return
  win[INSTALLED_KEY] = true

  const source = options.source ?? DEFAULT_SOURCE
  const flushDebounceMs = options.flushDebounceMs ?? DEFAULT_DEBOUNCE_MS
  const maxBatchSize = options.maxBatchSize ?? DEFAULT_BATCH_SIZE
  const maxQueueSize = options.maxQueueSize ?? DEFAULT_QUEUE_SIZE

  let queue: Array<{ source: string; level: number; code: number; message: string }> = []
  let droppedCount = 0
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let flushInProgress = false
  let internalSend = false
  const lastSeen = new Map<string, number>()

  const originalConsoleError = window.console.error.bind(window.console)

  const scheduleFlush = () => {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => {
      void flushNow()
    }, flushDebounceMs)
  }

  const enqueue = (event: { source: string; level: number; code: number; message: string }) => {
    if (!event.message) return

    const key = `${event.level}:${event.code}:${event.message}`
    const now = Date.now()
    const seenAt = lastSeen.get(key)
    if (seenAt && now - seenAt < DEDUPE_WINDOW_MS) {
      return
    }
    lastSeen.set(key, now)

    if (queue.length >= maxQueueSize) {
      droppedCount += 1
      return
    }

    queue.push(event)
    scheduleFlush()
  }

  const flushNow = async () => {
    if (flushInProgress || queue.length === 0) return
    flushInProgress = true

    try {
      if (droppedCount > 0) {
        queue.push({
          source,
          level: LEVEL_WARNING,
          code: CODE_DROPPED_EVENTS,
          message: `Dropped ${droppedCount} browser log events due to queue overflow`,
        })
        droppedCount = 0
      }

      while (queue.length > 0) {
        const batch = queue.splice(0, maxBatchSize)
        internalSend = true
        try {
          await Promise.all(batch.map((event) => logsClient.write(event)))
        } finally {
          internalSend = false
        }
      }
    } catch {
      // Keep runtime stable: logging failures must never crash the app.
    } finally {
      flushInProgress = false
    }
  }

  window.console.error = (...args: unknown[]) => {
    originalConsoleError(...args)
    if (internalSend) return

    enqueue({
      source,
      level: LEVEL_ERROR,
      code: CODE_CONSOLE_ERROR,
      message: normalizeArgs(args),
    })
  }

  window.addEventListener("error", (event) => {
    const errorPayload = event.error ?? event.message ?? "Unknown window error"
    const location =
      event.filename && event.lineno
        ? ` at ${event.filename}:${event.lineno}:${event.colno ?? 0}`
        : ""

    enqueue({
      source,
      level: LEVEL_ERROR,
      code: CODE_WINDOW_ERROR,
      message: trimMessage(`${stringify(errorPayload)}${location}`),
    })
  })

  window.addEventListener("unhandledrejection", (event) => {
    enqueue({
      source,
      level: LEVEL_ERROR,
      code: CODE_UNHANDLED_REJECTION,
      message: trimMessage(stringify(event.reason ?? "Unhandled rejection")),
    })
  })

  window.addEventListener("pagehide", () => {
    void flushNow()
  })
}
