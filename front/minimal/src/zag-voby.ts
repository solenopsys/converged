/* ZAG-VOBY ADAPTER */
/* Port of @zag-js/solid for Voby renderer */

import $ from "@solenopsys/converged-reactive";
import { effect, cleanup, untrack } from "@solenopsys/converged-reactive";
import {
  createScope,
  INIT_STATE,
  MachineStatus,
  mergeProps as zagMergeProps,
} from "@zag-js/core";
import {
  isObject,
  isString,
  isNumber,
  compact,
  ensure,
  isFunction,
  warn,
  toArray,
  isEqual,
} from "@zag-js/utils";
import { createNormalizer } from "@zag-js/types";

// createBindable - реактивное значение с дополнительными методами
function createBindable(props: () => any) {
  const initial = props().value ?? props().defaultValue;
  const eq = props().isEqual ?? Object.is;
  const value = $(initial);
  const controlled = () => props().value !== undefined;
  const valueRef = { current: initial };
  let prevValue = { current: undefined as any };

  effect(() => {
    const v = controlled() ? props().value : value();
    prevValue.current = valueRef.current;
    valueRef.current = v;
  });

  const set = (v: any) => {
    const prev = prevValue.current;
    const next = isFunction(v) ? v(valueRef.current) : v;
    console.log("[createBindable] set:", next, "prev:", prev);
    if (props().debug) {
      console.log(`[bindable > ${props().debug}] setValue`, { next, prev });
    }
    if (!controlled()) {
      value(next);
      valueRef.current = next;
    }
    if (!eq(next, prev)) {
      props().onChange?.(next, prev);
    }
  };

  function get() {
    // Вызываем value() чтобы подписаться на изменения
    const v = controlled() ? props().value : value();
    console.log("[createBindable] get:", v);
    return v;
  }

  return {
    initial,
    ref: valueRef,
    get,
    set,
    // Expose raw observable for Voby reactivity
    $value: value,
    invoke(nextValue: any, prevValue: any) {
      props().onChange?.(nextValue, prevValue);
    },
    hash(value: any) {
      return props().hash?.(value) ?? String(value);
    },
  };
}

createBindable.cleanup = (fn: () => void) => {
  cleanup(fn);
};

createBindable.ref = <T>(defaultValue: T) => {
  let value = defaultValue;
  return {
    get: () => value,
    set: (next: T) => {
      value = next;
    },
  };
};

// createRefs - хранилище ссылок
function createRefs<T extends Record<string, any>>(refs: T) {
  const ref = { current: refs };
  return {
    get<K extends keyof T>(key: K): T[K] {
      return ref.current[key];
    },
    set<K extends keyof T>(key: K, value: T[K]) {
      ref.current[key] = value;
    },
  };
}

function access<T>(v: T | (() => T)): T {
  if (isFunction(v)) return v();
  return v;
}

// createTrack - отслеживание изменений
const createTrack = (deps: any[], effectFn: () => void) => {
  let prevDeps: any[] = [];
  let isFirstRun = true;

  effect(() => {
    if (isFirstRun) {
      prevDeps = deps.map((d) => access(d));
      isFirstRun = false;
      return;
    }
    let changed = false;
    for (let i = 0; i < deps.length; i++) {
      if (!isEqual(prevDeps[i], access(deps[i]))) {
        changed = true;
        break;
      }
    }
    if (changed) {
      prevDeps = deps.map((d) => access(d));
      effectFn();
    }
  });
};

// useMachine - основной хук
export function useMachine(machine: any, userProps: any = {}) {
  const scope = () => {
    const { id, ids, getRootNode } = access(userProps);
    return createScope({ id, ids, getRootNode });
  };

  const debug = (...args: any[]) => {
    if (machine.debug) console.log(...args);
  };

  const props = () =>
    machine.props?.({
      props: compact(access(userProps)),
      scope: scope(),
    }) ?? access(userProps);

  const prop = createProp(props);

  const context = machine.context?.({
    prop,
    bindable: createBindable,
    get scope() {
      return scope();
    },
    flush,
    getContext() {
      return ctx;
    },
    getComputed() {
      return computed;
    },
    getRefs() {
      return refs;
    },
    getEvent() {
      return getEvent();
    },
  });

  const ctx = {
    get(key: string) {
      return context?.[key].get();
    },
    set(key: string, value: any) {
      context?.[key].set(value);
    },
    initial(key: string) {
      return context?.[key].initial;
    },
    hash(key: string) {
      const current = context?.[key].get();
      return context?.[key].hash(current);
    },
  };

  const effects = { current: new Map<string, () => void>() };
  const transitionRef = { current: null as any };
  const previousEventRef = { current: null as any };
  const eventRef = { current: { type: "" } };

  const getEvent = () => ({
    ...eventRef.current,
    current() {
      return eventRef.current;
    },
    previous() {
      return previousEventRef.current;
    },
  });

  const getState = () => ({
    ...state,
    matches(...values: string[]) {
      const current = state.get();
      return values.includes(current);
    },
    hasTag(tag: string) {
      const current = state.get();
      return !!machine.states[current]?.tags?.includes(tag);
    },
  });

  const refs = createRefs(machine.refs?.({ prop, context: ctx }) ?? {});

  const getParams = () => ({
    state: getState(),
    context: ctx,
    event: getEvent(),
    prop,
    send,
    action,
    guard,
    track: createTrack,
    refs,
    computed,
    flush,
    get scope() {
      return scope();
    },
    choose,
  });

  const action = (keys: any) => {
    const strs = isFunction(keys) ? keys(getParams()) : keys;
    if (!strs) return;
    const fns = strs.map((s: string) => {
      const fn = machine.implementations?.actions?.[s];
      if (!fn)
        warn(
          `[zag-js] No implementation found for action "${JSON.stringify(s)}"`,
        );
      return fn;
    });
    for (const fn of fns) {
      fn?.(getParams());
    }
  };

  const guard = (str: any) => {
    if (isFunction(str)) return str(getParams());
    return machine.implementations?.guards?.[str](getParams());
  };

  const effectFn = (keys: any) => {
    const strs = isFunction(keys) ? keys(getParams()) : keys;
    if (!strs) return;
    const fns = strs.map((s: string) => {
      const fn = machine.implementations?.effects?.[s];
      if (!fn)
        warn(
          `[zag-js] No implementation found for effect "${JSON.stringify(s)}"`,
        );
      return fn;
    });
    const cleanups: (() => void)[] = [];
    for (const fn of fns) {
      const cleanupFn = fn?.(getParams());
      if (cleanupFn) cleanups.push(cleanupFn);
    }
    return () => cleanups.forEach((fn) => fn?.());
  };

  const choose = (transitions: any) => {
    return toArray(transitions).find((t: any) => {
      let result = !t.guard;
      if (isString(t.guard)) result = !!guard(t.guard);
      else if (isFunction(t.guard)) result = t.guard(getParams());
      return result;
    });
  };

  const computed = (key: string) => {
    ensure(
      machine.computed,
      () => `[zag-js] No computed object found on machine`,
    );
    const fn = machine.computed[key];
    return fn({
      context: ctx,
      event: eventRef.current,
      prop,
      refs,
      scope: scope(),
      computed,
    });
  };

  const state = createBindable(() => ({
    defaultValue: machine.initialState({ prop }),
    onChange(nextState: string, prevState: string) {
      if (prevState) {
        const exitEffects = effects.current.get(prevState);
        exitEffects?.();
        effects.current.delete(prevState);
      }
      if (prevState) {
        action(machine.states[prevState]?.exit);
      }
      action(transitionRef.current?.actions);
      const cleanupFn = effectFn(machine.states[nextState]?.effects);
      if (cleanupFn) effects.current.set(nextState, cleanupFn);
      if (prevState === INIT_STATE) {
        action(machine.entry);
        const cleanupFn2 = effectFn(machine.effects);
        if (cleanupFn2) effects.current.set(INIT_STATE, cleanupFn2);
      }
      action(machine.states[nextState]?.entry);
    },
  }));

  let status = MachineStatus.NotStarted;

  // Initialize on mount
  console.log("[zag-voby] initializing machine, initial state:", state.initial);
  queueMicrotask(() => {
    const started = status === MachineStatus.Started;
    status = MachineStatus.Started;
    console.log("[zag-voby] machine started, status:", status);
    state.invoke(state.initial, INIT_STATE);
  });

  cleanup(() => {
    debug("unmounting...");
    status = MachineStatus.Stopped;
    const fns = effects.current;
    fns.forEach((fn) => fn?.());
    effects.current = new Map();
    transitionRef.current = null;
    action(machine.exit);
  });

  const send = (event: any) => {
    console.log("[zag-voby] send event:", event.type, event);
    console.log("[zag-voby] status:", status);
    queueMicrotask(() => {
      if (status !== MachineStatus.Started) {
        console.log("[zag-voby] machine not started, ignoring");
        return;
      }
      previousEventRef.current = eventRef.current;
      eventRef.current = event;
      let currentState = untrack(() => state.get());
      console.log("[zag-voby] currentState:", currentState);
      const transitions =
        machine.states[currentState]?.on?.[event.type] ??
        machine.on?.[event.type];
      console.log("[zag-voby] transitions:", transitions);
      const transition = choose(transitions);
      console.log("[zag-voby] transition:", transition);
      if (!transition) return;
      transitionRef.current = transition;
      const target = transition.target ?? currentState;
      console.log("[zag-voby] target:", target);
      const changed = target !== currentState;
      if (changed) {
        state.set(target);
      } else if (transition.reenter && !changed) {
        state.invoke(currentState, currentState);
      } else {
        action(transition.actions);
      }
    });
  };

  machine.watch?.(getParams());

  return {
    state: getState(),
    // Expose raw observable for Voby reactivity
    $state: state.$value,
    send,
    context: ctx,
    prop,
    get scope() {
      return scope();
    },
    refs,
    computed,
    event: getEvent(),
    getStatus: () => status,
  };
}

function flush(fn: () => void) {
  fn();
}

function createProp(value: () => any) {
  return function get(key: string) {
    return value()[key];
  };
}

// normalizeProps - конвертация пропсов для Voby
const eventMap: Record<string, string> = {
  onFocus: "onFocusIn",
  onBlur: "onFocusOut",
  onDoubleClick: "onDblClick",
  onChange: "onInput",
  defaultChecked: "checked",
  defaultValue: "value",
  htmlFor: "for",
  className: "class",
};

function toVobyProp(prop: string): string {
  return prop in eventMap ? eventMap[prop] : prop;
}

export const normalizeProps = createNormalizer((props: any) => {
  const normalized: any = {};
  for (const key in props) {
    const value = props[key];
    if (key === "readOnly" && value === false) {
      continue;
    }
    if (key === "style" && isObject(value)) {
      normalized["style"] = value;
      continue;
    }
    if (key === "children") {
      if (isString(value)) {
        normalized["textContent"] = value;
      }
      continue;
    }
    normalized[toVobyProp(key)] = value;
  }
  return normalized;
});

export { mergeProps } from "@zag-js/core";
