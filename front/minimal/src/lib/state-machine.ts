import {
  createStore,
  createEvent,
  sample,
  type Store,
  type Event,
} from "effector";

export type StateConfig<TState extends string, TEvent extends string> = {
  on?: Partial<Record<TEvent, TState | { target: TState; actions?: string[] }>>;
  entry?: string[];
  exit?: string[];
};

export type MachineConfig<
  TState extends string,
  TEvent extends string,
  TContext extends Record<string, any> = {},
> = {
  initial: TState;
  context?: TContext;
  states: Record<TState, StateConfig<TState, TEvent>>;
  actions?: Record<string, (ctx: TContext) => void | TContext>;
  effects?: Record<string, (ctx: TContext) => (() => void) | void>;
  delays?: Record<string, number>;
};

export type Machine<TState extends string, TEvent extends string, TContext> = {
  $state: Store<TState>;
  $context: Store<TContext>;
  send: Event<TEvent>;
  destroy: () => void;
};

export function createMachine<
  TState extends string,
  TEvent extends string,
  TContext extends Record<string, any> = {},
>(
  config: MachineConfig<TState, TEvent, TContext>,
): Machine<TState, TEvent, TContext> {
  const $state = createStore<TState>(config.initial);
  const $context = createStore<TContext>((config.context || {}) as TContext);
  const send = createEvent<TEvent>();

  let cleanupEffects: (() => void)[] = [];
  let timers: number[] = [];

  const runActions = (actionNames: string[] | undefined, ctx: TContext) => {
    if (!actionNames || !config.actions) return ctx;
    let newCtx = ctx;
    for (const name of actionNames) {
      const action = config.actions[name];
      if (action) {
        const result = action(newCtx);
        if (result) newCtx = result;
      }
    }
    return newCtx;
  };

  const runEffects = (state: TState, ctx: TContext) => {
    // Cleanup previous effects
    cleanupEffects.forEach((fn) => fn());
    cleanupEffects = [];
    timers.forEach((id) => clearTimeout(id));
    timers = [];

    if (!config.effects) return;

    const stateConfig = config.states[state];
    if (!stateConfig) return;

    // Run state-specific effects based on naming convention
    for (const [name, effect] of Object.entries(config.effects)) {
      // Check if this effect should run for current state
      if (name.startsWith(`${state}.`)) {
        const cleanup = effect(ctx);
        if (cleanup) cleanupEffects.push(cleanup);
      }
    }
  };

  sample({
    clock: send,
    source: { state: $state, context: $context },
    fn: ({ state, context }, event) => {
      const stateConfig = config.states[state];
      if (!stateConfig?.on) return { state, context };

      const transition = stateConfig.on[event];
      if (!transition) return { state, context };

      let newState: TState;
      let actions: string[] | undefined;

      if (typeof transition === "string") {
        newState = transition;
      } else {
        newState = transition.target;
        actions = transition.actions;
      }

      // Run exit actions
      let newContext = runActions(config.states[state]?.exit, context);
      // Run transition actions
      newContext = runActions(actions, newContext);
      // Run entry actions
      newContext = runActions(config.states[newState]?.entry, newContext);

      return { state: newState, context: newContext };
    },
    target: [
      $state.prepend(({ state }) => state),
      $context.prepend(({ context }) => context),
    ],
  });

  // Run effects on state change
  $state.watch((state) => {
    runEffects(state, $context.getState());
  });

  // Initial effects
  runEffects(config.initial, $context.getState());

  const destroy = () => {
    cleanupEffects.forEach((fn) => fn());
    cleanupEffects = [];
    timers.forEach((id) => clearTimeout(id));
    timers = [];
  };

  return {
    $state,
    $context,
    send,
    destroy,
  };
}

// Helper to create delayed events
export function createDelayedSend<TEvent extends string>(
  send: Event<TEvent>,
  delays: Record<string, number>,
) {
  const timers = new Map<string, number>();

  return {
    after: (delayName: string, event: TEvent) => {
      const delay = delays[delayName];
      if (delay === undefined) return;

      const id = window.setTimeout(() => {
        send(event);
        timers.delete(delayName);
      }, delay);
      timers.set(delayName, id);
    },
    cancel: (delayName: string) => {
      const id = timers.get(delayName);
      if (id) {
        clearTimeout(id);
        timers.delete(delayName);
      }
    },
    cancelAll: () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
    },
  };
}
