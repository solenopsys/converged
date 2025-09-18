// Enhanced Effector Domain Logger
// Provides comprehensive logging for Effector domains with filtering, redaction, and child domain support

interface EffectorUnit {
    compositeName: {
      fullName: string;
    };
    watch: (fn: (payload: unknown) => void) => () => void;
  }
  
  interface EffectorEffect extends EffectorUnit {
    done: {
      watch: (fn: (data: { result: unknown }) => void) => () => void;
    };
    fail: {
      watch: (fn: (data: { error: unknown }) => void) => () => void;
    };
    finally: {
      watch: (fn: (data: unknown) => void) => () => void;
    };
  }
  
  interface EffectorDomain {
    compositeName: {
      fullName: string;
    };
    onCreateEvent: (handler: (event: EffectorUnit) => void) => () => void;
    onCreateEffect: (handler: (effect: EffectorEffect) => void) => () => void;
    onCreateDomain: (handler: (domain: EffectorDomain) => void) => () => void;
  }
  
  interface DomainLoggerOptions {
    /** Enable event logging (default: true) */
    logEvents?: boolean;
    
    /** Enable effect logging (default: true) */
    logEffects?: boolean;
    
    /** Include child domains in logging (default: true) */
    includeChildren?: boolean;
    
    /** Filter function for unit names - return true to log, false to skip */
    filter?: (unitName: string) => boolean;
    
    /** Data redaction function for sensitive information */
    redact?: (value: unknown, path: string) => unknown;
    
    /** Maximum length of logged output before truncation (default: 2000) */
    maxLen?: number;
    
    /** Master switch to enable/disable logging (default: NODE_ENV !== "production") */
    enabled?: boolean;
    
    /** Additional tag for log prefixes */
    tag?: string;
    
    /** Custom console methods for different log levels */
    console?: {
      event?: (message: string, ...args: unknown[]) => void;
      effectStart?: (message: string, ...args: unknown[]) => void;
      effectSuccess?: (message: string, ...args: unknown[]) => void;
      effectFail?: (message: string, ...args: unknown[]) => void;
      effectFinally?: (message: string, ...args: unknown[]) => void;
    };
  }
  
  type LogLevel = 'EVENT' | 'EFFECT_START' | 'EFFECT_SUCCESS' | 'EFFECT_FAIL' | 'EFFECT_FINALLY';
  
  const DEFAULT_MAX_LENGTH = 2000;
  const TRUNCATION_SUFFIX = '…(truncated)';
  
  /**
   * Creates a comprehensive logger for Effector domains
   * Automatically logs events, effects, and child domains with filtering and redaction support
   * 
   * @param domain - Effector domain to log
   * @param options - Logging configuration options
   * @returns Cleanup function to stop logging
   */
  export function createDomainLogger(
    domain: EffectorDomain, 
    options: DomainLoggerOptions = {}
  ): () => void {
    const config = createLoggerConfig(domain, options);
    
    if (!config.enabled) {
      return () => {}; // No-op cleanup function
    }
  
    const subscriptions = new Set<() => void>();
    const logger = createLogger(config);
  
    // Set up event logging
    if (config.logEvents) {
      const unsubscribe = domain.onCreateEvent((event) => {
        setupEventLogging(event, logger, subscriptions);
      });
      subscriptions.add(unsubscribe);
    }
  
    // Set up effect logging
    if (config.logEffects) {
      const unsubscribe = domain.onCreateEffect((effect) => {
        setupEffectLogging(effect, logger, subscriptions);
      });
      subscriptions.add(unsubscribe);
    }
  
    // Set up child domain logging
    if (config.includeChildren) {
      const unsubscribe = domain.onCreateDomain((childDomain) => {
        const childCleanup = createDomainLogger(childDomain, {
          ...options,
          tag: config.tag, // Preserve parent tag
        });
        subscriptions.add(childCleanup);
      });
      subscriptions.add(unsubscribe);
    }
  
    return createCleanupFunction(subscriptions);
  }
  
  // === Helper Functions ===
  
  function createLoggerConfig(domain: EffectorDomain, options: DomainLoggerOptions) {
    const {
      logEvents = true,
      logEffects = true,
      includeChildren = true,
      filter = () => true,
      redact = (value) => value,
      maxLen = DEFAULT_MAX_LENGTH,
      enabled = process.env.NODE_ENV !== 'production',
      tag,
      console: customConsole,
    } = options;
  
    return {
      logEvents,
      logEffects,
      includeChildren,
      filter,
      redact,
      maxLen,
      enabled,
      tag: tag ?? domain.compositeName.fullName,
      console: {
        event: customConsole?.event ?? console.log,
        effectStart: customConsole?.effectStart ?? console.log,
        effectSuccess: customConsole?.effectSuccess ?? console.log,
        effectFail: customConsole?.effectFail ?? console.error,
        effectFinally: customConsole?.effectFinally ?? console.log,
      },
    };
  }
  
  function createLogger(config: ReturnType<typeof createLoggerConfig>) {
    const prefix = `[${config.tag}]`;
  
    const serializeValue = (value: unknown): string => {
      try {
        const redacted = config.redact(value, '');
        const serialized = JSON.stringify(redacted, (key, val) => 
          config.redact(val, key)
        );
        
        return serialized.length > config.maxLen 
          ? serialized.slice(0, config.maxLen) + TRUNCATION_SUFFIX
          : serialized;
      } catch (error) {
        // Fallback for non-serializable values
        return String(value);
      }
    };
  
    return {
      log: (level: LogLevel, unitName: string, payload: unknown) => {
        if (!config.filter(unitName)) return;
  
        const serializedPayload = serializeValue(payload);
        const logMethod = getLogMethod(level, config.console);
        
        logMethod(`${prefix} ${level}`, unitName, serializedPayload);
      },
    };
  }
  
  function getLogMethod(level: LogLevel, consoleMethods: ReturnType<typeof createLoggerConfig>['console']) {
    switch (level) {
      case 'EVENT': return consoleMethods.event;
      case 'EFFECT_START': return consoleMethods.effectStart;
      case 'EFFECT_SUCCESS': return consoleMethods.effectSuccess;
      case 'EFFECT_FAIL': return consoleMethods.effectFail;
      case 'EFFECT_FINALLY': return consoleMethods.effectFinally;
      default: return console.log;
    }
  }
  
  function setupEventLogging(
    event: EffectorUnit,
    logger: ReturnType<typeof createLogger>,
    subscriptions: Set<() => void>
  ) {
    const unitName = event.compositeName.fullName;
    
    const unsubscribe = event.watch((payload) => {
      logger.log('EVENT', unitName, payload);
    });
    
    subscriptions.add(unsubscribe);
  }
  
  function setupEffectLogging(
    effect: EffectorEffect,
    logger: ReturnType<typeof createLogger>,
    subscriptions: Set<() => void>
  ) {
    const unitName = effect.compositeName.fullName;
  
    // Effect start
    const startUnsub = effect.watch((params) => {
      logger.log('EFFECT_START', unitName, params);
    });
  
    // Effect success
    const successUnsub = effect.done.watch(({ result }) => {
      logger.log('EFFECT_SUCCESS', unitName, result);
    });
  
    // Effect failure
    const failUnsub = effect.fail.watch(({ error }) => {
      logger.log('EFFECT_FAIL', unitName, error);
    });
  
    // Effect completion (always runs)
    const finallyUnsub = effect.finally.watch((data) => {
      logger.log('EFFECT_FINALLY', unitName, data);
    });
  
    subscriptions.add(startUnsub);
    subscriptions.add(successUnsub);
    subscriptions.add(failUnsub);
    subscriptions.add(finallyUnsub);
  }
  
  function createCleanupFunction(subscriptions: Set<() => void>): () => void {
    return () => {
      for (const unsubscribe of subscriptions) {
        try {
          unsubscribe();
        } catch (error) {
          // Silently handle cleanup errors to prevent cascading failures
          console.warn('Domain logger cleanup error:', error);
        }
      }
      subscriptions.clear();
    };
  }
  
  // === Utility Functions for Advanced Usage ===
  
  /**
   * Creates a filter function that only logs specific unit names
   */
  export function createWhitelist(allowedNames: string[]) {
    const allowedSet = new Set(allowedNames);
    return (unitName: string) => allowedSet.has(unitName);
  }
  
  /**
   * Creates a filter function that excludes specific unit names
   */
  export function createBlacklist(blockedNames: string[]) {
    const blockedSet = new Set(blockedNames);
    return (unitName: string) => !blockedSet.has(unitName);
  }
  
  /**
   * Creates a redaction function that masks sensitive data
   */
  export function createRedactor(sensitiveKeys: string[]) {
    const sensitiveSet = new Set(sensitiveKeys.map(key => key.toLowerCase()));
    
    return (value: unknown, path: string): unknown => {
      if (typeof value === 'object' && value !== null) {
        const redacted: Record<string, unknown> = {};
        
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
          redacted[key] = sensitiveSet.has(key.toLowerCase()) ? '[REDACTED]' : val;
        }
        
        return redacted;
      }
      
      return sensitiveSet.has(path.toLowerCase()) ? '[REDACTED]' : value;
    };
  }
  
  // === Example Usage ===
  
  /*
  // Basic usage
  const cleanup = createDomainLogger(myDomain);
  
  // Advanced usage with all options
  const advancedCleanup = createDomainLogger(myDomain, {
    logEvents: true,
    logEffects: true,
    includeChildren: true,
    filter: createWhitelist(['user/login', 'user/logout']),
    redact: createRedactor(['password', 'token', 'secret']),
    maxLen: 1000,
    enabled: true,
    tag: 'MyApp',
    console: {
      event: (msg, ...args) => console.debug(`🎯 ${msg}`, ...args),
      effectStart: (msg, ...args) => console.info(`⚡ ${msg}`, ...args),
      effectSuccess: (msg, ...args) => console.info(`✅ ${msg}`, ...args),
      effectFail: (msg, ...args) => console.error(`❌ ${msg}`, ...args),
      effectFinally: (msg, ...args) => console.debug(`🏁 ${msg}`, ...args),
    },
  });
  
  // Don't forget to cleanup when done
  cleanup();
  advancedCleanup();
  */