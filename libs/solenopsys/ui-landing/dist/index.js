// src/styles/banner.module.css
var banner_module_default = "./banner.module-arec3hra.css";

// node_modules/@solenopsys/converged-reactive/dist/index.js
var SYMBOL_CACHED = Symbol("Cached");
var SYMBOL_OBSERVABLE = Symbol("Observable");
var SYMBOL_OBSERVABLE_BOOLEAN = Symbol("Observable.Boolean");
var SYMBOL_OBSERVABLE_FROZEN = Symbol("Observable.Frozen");
var SYMBOL_OBSERVABLE_READABLE = Symbol("Observable.Readable");
var SYMBOL_OBSERVABLE_WRITABLE = Symbol("Observable.Writable");
var SYMBOL_STORE = Symbol("Store");
var SYMBOL_STORE_KEYS = Symbol("Store.Keys");
var SYMBOL_STORE_OBSERVABLE = Symbol("Store.Observable");
var SYMBOL_STORE_TARGET = Symbol("Store.Target");
var SYMBOL_STORE_VALUES = Symbol("Store.Values");
var SYMBOL_STORE_UNTRACKED = Symbol("Store.Untracked");
var SYMBOL_SUSPENSE = Symbol("Suspense");
var SYMBOL_UNCACHED = Symbol("Uncached");
var SYMBOL_UNTRACKED = Symbol("Untracked");
var SYMBOL_UNTRACKED_UNWRAPPED = Symbol("Untracked.Unwrapped");
var castArray = (value) => {
  return isArray(value) ? value : [value];
};
var castError = (error) => {
  if (error instanceof Error)
    return error;
  if (typeof error === "string")
    return new Error(error);
  return new Error("Unknown error");
};
var { is } = Object;
var { isArray } = Array;
var isEqual = (a, b) => {
  if (a.length !== b.length)
    return false;
  for (let i = 0, l = a.length;i < l; i++) {
    const valueA = a[i];
    const valueB = b[i];
    if (!is(valueA, valueB))
      return false;
  }
  return true;
};
var isFunction = (value) => {
  return typeof value === "function";
};
var isObject = (value) => {
  return value !== null && typeof value === "object";
};
var isSymbol = (value) => {
  return typeof value === "symbol";
};
var noop = () => {
  return;
};
var nope = () => {
  return false;
};
var frozenFunction = function() {
  if (arguments.length) {
    throw new Error("A readonly Observable can not be updated");
  } else {
    return this;
  }
};
var readableFunction = function() {
  if (arguments.length) {
    throw new Error("A readonly Observable can not be updated");
  } else {
    return this.get();
  }
};
var writableFunction = function(fn) {
  if (arguments.length) {
    if (isFunction(fn)) {
      return this.update(fn);
    } else {
      return this.set(fn);
    }
  } else {
    return this.get();
  }
};
var frozen = (value) => {
  const fn = frozenFunction.bind(value);
  fn[SYMBOL_OBSERVABLE] = true;
  fn[SYMBOL_OBSERVABLE_FROZEN] = true;
  return fn;
};
var readable = (value) => {
  const fn = readableFunction.bind(value);
  fn[SYMBOL_OBSERVABLE] = true;
  fn[SYMBOL_OBSERVABLE_READABLE] = value;
  return fn;
};
var writable = (value) => {
  const fn = writableFunction.bind(value);
  fn[SYMBOL_OBSERVABLE] = true;
  fn[SYMBOL_OBSERVABLE_WRITABLE] = value;
  return fn;
};
var DIRTY_NO = 0;
var DIRTY_MAYBE_NO = 1;
var DIRTY_MAYBE_YES = 2;
var DIRTY_YES = 3;
var OBSERVABLE_FALSE = frozen(false);
var OBSERVABLE_TRUE = frozen(true);
var UNAVAILABLE = new Proxy({}, new Proxy({}, {
  get() {
    throw new Error("Unavailable value");
  }
}));
var UNINITIALIZED = function() {
};
var lazyArrayEach = (arr, fn) => {
  if (arr instanceof Array) {
    for (let i = 0, l = arr.length;i < l; i++) {
      fn(arr[i]);
    }
  } else if (arr) {
    fn(arr);
  }
};
var lazyArrayEachRight = (arr, fn) => {
  if (arr instanceof Array) {
    for (let i = arr.length - 1;i >= 0; i--) {
      fn(arr[i]);
    }
  } else if (arr) {
    fn(arr);
  }
};
var lazyArrayPush = (obj, key, value) => {
  const arr = obj[key];
  if (arr instanceof Array) {
    arr.push(value);
  } else if (arr) {
    obj[key] = [arr, value];
  } else {
    obj[key] = value;
  }
};
var lazySetAdd = (obj, key, value) => {
  const set = obj[key];
  if (set instanceof Set) {
    set.add(value);
  } else if (set) {
    if (value !== set) {
      const s = new Set;
      s.add(set);
      s.add(value);
      obj[key] = s;
    }
  } else {
    obj[key] = value;
  }
};
var lazySetDelete = (obj, key, value) => {
  const set = obj[key];
  if (set instanceof Set) {
    set.delete(value);
  } else if (set === value) {
    obj[key] = undefined;
  }
};
var lazySetEach = (set, fn) => {
  if (set instanceof Set) {
    for (const value of set) {
      fn(value);
    }
  } else if (set) {
    fn(set);
  }
};
var onCleanup = (cleanup) => cleanup.call(cleanup);
var onDispose = (owner) => owner.dispose(true);

class Owner {
  parent;
  context;
  disposed = false;
  cleanups = undefined;
  errorHandler = undefined;
  contexts = undefined;
  observers = undefined;
  roots = undefined;
  suspenses = undefined;
  catch(error, silent) {
    const { errorHandler } = this;
    if (errorHandler) {
      errorHandler(error);
      return true;
    } else {
      if (this.parent?.catch(error, true))
        return true;
      if (silent)
        return false;
      throw error;
    }
  }
  dispose(deep) {
    lazyArrayEachRight(this.contexts, onDispose);
    lazyArrayEachRight(this.observers, onDispose);
    lazyArrayEachRight(this.suspenses, onDispose);
    lazyArrayEachRight(this.cleanups, onCleanup);
    this.cleanups = undefined;
    this.disposed = deep;
    this.errorHandler = undefined;
    this.observers = undefined;
    this.suspenses = undefined;
  }
  get(symbol) {
    return this.context?.[symbol];
  }
  wrap(fn, owner, observer) {
    const ownerPrev = OWNER;
    const observerPrev = OBSERVER;
    setOwner(owner);
    setObserver(observer);
    try {
      return fn();
    } catch (error) {
      this.catch(castError(error), false);
      return UNAVAILABLE;
    } finally {
      setOwner(ownerPrev);
      setObserver(observerPrev);
    }
  }
}
var owner_default = Owner;

class SuperRoot extends owner_default {
  constructor() {
    super(...arguments);
  }
  context = {};
}
var superroot_default = SuperRoot;
var BATCH;
var SUPER_OWNER = new superroot_default;
var OBSERVER;
var OWNER = SUPER_OWNER;
var setBatch = (value) => BATCH = value;
var setObserver = (value) => OBSERVER = value;
var setOwner = (value) => OWNER = value;
var counter = 0;
var resolve = noop;
var batch = async (fn) => {
  if (!counter) {
    setBatch(new Promise((r) => resolve = r));
  }
  try {
    counter += 1;
    return await fn();
  } finally {
    counter -= 1;
    if (!counter) {
      setBatch(undefined);
      resolve();
    }
  }
};
var batch_default = batch;
var isObservableBoolean = (value) => {
  return isFunction(value) && SYMBOL_OBSERVABLE_BOOLEAN in value;
};
var is_observable_boolean_default = isObservableBoolean;
var isObservableFrozen = (value) => {
  return isFunction(value) && ((SYMBOL_OBSERVABLE_FROZEN in value) || !!value[SYMBOL_OBSERVABLE_READABLE]?.parent?.disposed);
};
var is_observable_frozen_default = isObservableFrozen;
var isUntracked = (value) => {
  return isFunction(value) && ((SYMBOL_UNTRACKED in value) || (SYMBOL_UNTRACKED_UNWRAPPED in value));
};
var is_untracked_default = isUntracked;

class Scheduler {
  waiting = [];
  counter = 0;
  locked = false;
  flush = () => {
    if (this.locked)
      return;
    if (this.counter)
      return;
    if (!this.waiting.length)
      return;
    try {
      this.locked = true;
      while (true) {
        const queue = this.waiting;
        if (!queue.length)
          break;
        this.waiting = [];
        for (let i = 0, l = queue.length;i < l; i++) {
          queue[i].update();
        }
      }
    } finally {
      this.locked = false;
    }
  };
  wrap = (fn) => {
    this.counter += 1;
    fn();
    this.counter -= 1;
    this.flush();
  };
  schedule = (observer) => {
    this.waiting.push(observer);
  };
}
var scheduler_sync_default = new Scheduler;

class Observable {
  parent;
  value;
  equals;
  observers = new Set;
  constructor(value, options, parent) {
    this.value = value;
    if (parent) {
      this.parent = parent;
    }
    if (options?.equals !== undefined) {
      this.equals = options.equals || nope;
    }
  }
  get() {
    if (!this.parent?.disposed) {
      this.parent?.update();
      OBSERVER?.observables.link(this);
    }
    return this.value;
  }
  set(value) {
    const equals = this.equals || is;
    const fresh = this.value === UNINITIALIZED || !equals(value, this.value);
    if (!fresh)
      return value;
    this.value = value;
    scheduler_sync_default.counter += 1;
    this.stale(DIRTY_YES);
    scheduler_sync_default.counter -= 1;
    scheduler_sync_default.flush();
    return value;
  }
  stale(status) {
    for (const observer of this.observers) {
      if (observer.status !== DIRTY_MAYBE_NO || observer.observables.has(this)) {
        if (observer.sync) {
          observer.status = Math.max(observer.status, status);
          scheduler_sync_default.schedule(observer);
        } else {
          observer.stale(status);
        }
      }
    }
  }
  update(fn) {
    const value = fn(this.value);
    return this.set(value);
  }
}
var observable_default = Observable;

class ObservablesArray {
  observer;
  observables;
  observablesIndex;
  constructor(observer) {
    this.observer = observer;
    this.observables = [];
    this.observablesIndex = 0;
  }
  dispose(deep) {
    if (deep) {
      const { observer, observables } = this;
      for (let i = 0;i < observables.length; i++) {
        observables[i].observers.delete(observer);
      }
    }
    this.observablesIndex = 0;
  }
  postdispose() {
    const { observer, observables, observablesIndex } = this;
    const observablesLength = observables.length;
    if (observablesIndex < observablesLength) {
      for (let i = observablesIndex;i < observablesLength; i++) {
        observables[i].observers.delete(observer);
      }
      observables.length = observablesIndex;
    }
  }
  empty() {
    return !this.observables.length;
  }
  has(observable) {
    const index = this.observables.indexOf(observable);
    return index >= 0 && index < this.observablesIndex;
  }
  link(observable) {
    const { observer, observables, observablesIndex } = this;
    const observablesLength = observables.length;
    if (observablesLength > 0) {
      if (observables[observablesIndex] === observable) {
        this.observablesIndex += 1;
        return;
      }
      const index = observables.indexOf(observable);
      if (index >= 0 && index < observablesIndex) {
        return;
      }
      if (observablesIndex < observablesLength - 1) {
        this.postdispose();
      } else if (observablesIndex === observablesLength - 1) {
        observables[observablesIndex].observers.delete(observer);
      }
    }
    observable.observers.add(observer);
    observables[this.observablesIndex++] = observable;
    if (observablesIndex === 128) {
      observer.observables = new ObservablesSet(observer, observables);
    }
  }
  update() {
    const { observables } = this;
    for (let i = 0, l = observables.length;i < l; i++) {
      observables[i].parent?.update();
    }
  }
}

class ObservablesSet {
  observer;
  observables;
  constructor(observer, observables) {
    this.observer = observer;
    this.observables = new Set(observables);
  }
  dispose(deep) {
    for (const observable of this.observables) {
      observable.observers.delete(this.observer);
    }
  }
  postdispose() {
    return;
  }
  empty() {
    return !this.observables.size;
  }
  has(observable) {
    return this.observables.has(observable);
  }
  link(observable) {
    const { observer, observables } = this;
    const sizePrev = observables.size;
    observable.observers.add(observer);
    const sizeNext = observables.size;
    if (sizePrev === sizeNext)
      return;
    observables.add(observable);
  }
  update() {
    for (const observable of this.observables) {
      observable.parent?.update();
    }
  }
}

class Observer extends owner_default {
  parent = OWNER;
  context = OWNER.context;
  status = DIRTY_YES;
  observables;
  sync;
  constructor() {
    super();
    this.observables = new ObservablesArray(this);
    if (OWNER !== SUPER_OWNER) {
      lazyArrayPush(this.parent, "observers", this);
    }
  }
  dispose(deep) {
    this.observables.dispose(deep);
    super.dispose(deep);
  }
  refresh(fn) {
    this.dispose(false);
    this.status = DIRTY_MAYBE_NO;
    try {
      return this.wrap(fn, this, this);
    } finally {
      this.observables.postdispose();
    }
  }
  run() {
    throw new Error("Abstract method");
  }
  stale(status) {
    throw new Error("Abstract method");
  }
  update() {
    if (this.disposed)
      return;
    if (this.status === DIRTY_MAYBE_YES) {
      this.observables.update();
    }
    if (this.status === DIRTY_YES) {
      this.status = DIRTY_MAYBE_NO;
      this.run();
      if (this.status === DIRTY_MAYBE_NO) {
        this.status = DIRTY_NO;
      } else {
        this.update();
      }
    } else {
      this.status = DIRTY_NO;
    }
  }
}
var observer_default = Observer;

class Memo extends observer_default {
  fn;
  observable;
  declaresync;
  constructor(fn, options) {
    super();
    this.fn = fn;
    this.observable = new observable_default(UNINITIALIZED, options, this);
    if (options?.sync === true) {
      this.sync = true;
      this.update();
    }
  }
  run() {
    const result = super.refresh(this.fn);
    if (!this.disposed && this.observables.empty()) {
      this.disposed = true;
    }
    if (result !== UNAVAILABLE) {
      this.observable.set(result);
    }
  }
  stale(status) {
    const statusPrev = this.status;
    if (statusPrev >= status)
      return;
    this.status = status;
    if (statusPrev === DIRTY_MAYBE_YES)
      return;
    this.observable.stale(DIRTY_MAYBE_YES);
  }
}
var memo_default = Memo;
var memo2 = (fn, options) => {
  if (is_observable_frozen_default(fn)) {
    return fn;
  } else if (is_untracked_default(fn)) {
    return frozen(fn());
  } else {
    const memo3 = new memo_default(fn, options);
    const observable2 = readable(memo3.observable);
    return observable2;
  }
};
var memo_default2 = memo2;
var boolean = (value) => {
  if (isFunction(value)) {
    if (is_observable_frozen_default(value) || is_untracked_default(value)) {
      return !!value();
    } else if (is_observable_boolean_default(value)) {
      return value;
    } else {
      const boolean2 = memo_default2(() => !!value());
      boolean2[SYMBOL_OBSERVABLE_BOOLEAN] = true;
      return boolean2;
    }
  } else {
    return !!value;
  }
};
var boolean_default = boolean;
var cleanup = (fn) => {
  lazyArrayPush(OWNER, "cleanups", fn);
};
var cleanup_default = cleanup;

class Context extends owner_default {
  parent = OWNER;
  context;
  constructor(context7) {
    super();
    this.context = { ...OWNER.context, ...context7 };
    lazyArrayPush(this.parent, "contexts", this);
  }
  wrap(fn) {
    return super.wrap(fn, this, undefined);
  }
}
var context_default = Context;
var context9 = (symbolOrContext, fn) => {
  if (isSymbol(symbolOrContext)) {
    return OWNER.context[symbolOrContext];
  } else {
    return new context_default(symbolOrContext).wrap(fn || noop);
  }
};
var context_default2 = context9;
var disposed = () => {
  const observable3 = new observable_default(false);
  const toggle = () => observable3.set(true);
  cleanup_default(toggle);
  return readable(observable3);
};
var disposed_default = disposed;

class Scheduler2 {
  waiting = [];
  locked = false;
  queued = false;
  flush = () => {
    if (this.locked)
      return;
    if (!this.waiting.length)
      return;
    try {
      this.locked = true;
      while (true) {
        const queue = this.waiting;
        if (!queue.length)
          break;
        this.waiting = [];
        for (let i = 0, l = queue.length;i < l; i++) {
          queue[i].update();
        }
      }
    } finally {
      this.locked = false;
    }
  };
  queue = () => {
    if (this.queued)
      return;
    this.queued = true;
    this.resolve();
  };
  resolve = () => {
    queueMicrotask(() => {
      queueMicrotask(() => {
        if (BATCH) {
          BATCH.finally(this.resolve);
        } else {
          this.queued = false;
          this.flush();
        }
      });
    });
  };
  schedule = (effect) => {
    this.waiting.push(effect);
    this.queue();
  };
}
var scheduler_async_default = new Scheduler2;

class Effect extends observer_default {
  fn;
  suspense;
  init;
  constructor(fn, options) {
    super();
    this.fn = fn;
    if (options?.suspense !== false) {
      const suspense = this.get(SYMBOL_SUSPENSE);
      if (suspense) {
        this.suspense = suspense;
      }
    }
    if (options?.sync === true) {
      this.sync = true;
    }
    if (options?.sync === "init") {
      this.init = true;
      this.update();
    } else {
      this.schedule();
    }
  }
  run() {
    const result = super.refresh(this.fn);
    if (isFunction(result)) {
      lazyArrayPush(this, "cleanups", result);
    }
  }
  schedule() {
    if (this.suspense?.suspended)
      return;
    if (this.sync) {
      this.update();
    } else {
      scheduler_async_default.schedule(this);
    }
  }
  stale(status) {
    const statusPrev = this.status;
    if (statusPrev >= status)
      return;
    this.status = status;
    if (!this.sync || statusPrev !== 2 && statusPrev !== 3) {
      this.schedule();
    }
  }
  update() {
    if (this.suspense?.suspended)
      return;
    super.update();
  }
}
var effect_default = Effect;
var effect2 = (fn, options) => {
  const effect3 = new effect_default(fn, options);
  const dispose = () => effect3.dispose(true);
  return dispose;
};
var effect_default2 = effect2;
var resolveImpl = (value) => {
  if (isFunction(value)) {
    if (SYMBOL_UNTRACKED_UNWRAPPED in value) {
      return resolveImpl(value());
    } else if (SYMBOL_UNTRACKED in value) {
      return frozen(resolveImpl(value()));
    } else if (SYMBOL_OBSERVABLE in value) {
      return value;
    } else {
      return memo_default2(() => resolveImpl(value()));
    }
  }
  if (value instanceof Array) {
    const resolved = new Array(value.length);
    for (let i = 0, l = resolved.length;i < l; i++) {
      resolved[i] = resolveImpl(value[i]);
    }
    return resolved;
  } else {
    return value;
  }
};
var resolve2 = resolveImpl;
var resolve_default = resolve2;

class Root extends owner_default {
  parent = OWNER;
  context = OWNER.context;
  registered;
  constructor(register) {
    super();
    if (register) {
      const suspense = this.get(SYMBOL_SUSPENSE);
      if (suspense) {
        this.registered = true;
        lazySetAdd(this.parent, "roots", this);
      }
    }
  }
  dispose(deep) {
    if (this.registered) {
      lazySetDelete(this.parent, "roots", this);
    }
    super.dispose(deep);
  }
  wrap(fn) {
    const dispose = () => this.dispose(true);
    const fnWithDispose = () => fn(dispose);
    return super.wrap(fnWithDispose, this, undefined);
  }
}
var root_default = Root;
var DUMMY_INDEX = frozen(-1);

class MappedRoot extends root_default {
  constructor() {
    super(...arguments);
  }
  bool;
  index;
  result;
}

class CacheKeyed {
  parent = OWNER;
  suspense = OWNER.get(SYMBOL_SUSPENSE);
  fn;
  fnWithIndex;
  cache = new Map;
  bool = false;
  prevCount = 0;
  reuseCount = 0;
  nextCount = 0;
  constructor(fn) {
    this.fn = fn;
    this.fnWithIndex = fn.length > 1;
    if (this.suspense) {
      lazySetAdd(this.parent, "roots", this.roots);
    }
  }
  cleanup = () => {
    if (!this.prevCount)
      return;
    if (this.prevCount === this.reuseCount)
      return;
    const { cache, bool } = this;
    if (!cache.size)
      return;
    if (this.nextCount) {
      cache.forEach((mapped, value) => {
        if (mapped.bool === bool)
          return;
        mapped.dispose(true);
        cache.delete(value);
      });
    } else {
      this.cache.forEach((mapped) => {
        mapped.dispose(true);
      });
      this.cache = new Map;
    }
  };
  dispose = () => {
    if (this.suspense) {
      lazySetDelete(this.parent, "roots", this.roots);
    }
    this.prevCount = this.cache.size;
    this.reuseCount = 0;
    this.nextCount = 0;
    this.cleanup();
  };
  before = () => {
    this.bool = !this.bool;
    this.reuseCount = 0;
    this.nextCount = 0;
  };
  after = (values) => {
    this.nextCount = values.length;
    this.cleanup();
    this.prevCount = this.nextCount;
    this.reuseCount = 0;
  };
  map = (values) => {
    this.before();
    const { cache, bool, fn, fnWithIndex } = this;
    const results = new Array(values.length);
    let resultsCached = true;
    let resultsUncached = true;
    let reuseCount = 0;
    for (let i = 0, l = values.length;i < l; i++) {
      const value = values[i];
      const cached = cache.get(value);
      if (cached && cached.bool !== bool) {
        resultsUncached = false;
        reuseCount += 1;
        cached.bool = bool;
        cached.index?.set(i);
        results[i] = cached.result;
      } else {
        resultsCached = false;
        const mapped = new MappedRoot(false);
        if (cached) {
          cleanup_default(() => mapped.dispose(true));
        }
        mapped.wrap(() => {
          let index = DUMMY_INDEX;
          if (fnWithIndex) {
            mapped.index = new observable_default(i);
            index = readable(mapped.index);
          }
          const result = results[i] = resolve_default(fn(value, index));
          mapped.bool = bool;
          mapped.result = result;
          if (!cached) {
            cache.set(value, mapped);
          }
        });
      }
    }
    this.reuseCount = reuseCount;
    this.after(values);
    if (resultsCached) {
      results[SYMBOL_CACHED] = true;
    }
    if (resultsUncached) {
      results[SYMBOL_UNCACHED] = true;
    }
    return results;
  };
  roots = () => {
    return Array.from(this.cache.values());
  };
}
var for_cache_keyed_default = CacheKeyed;
var isObservable = (value) => {
  return isFunction(value) && SYMBOL_OBSERVABLE in value;
};
var is_observable_default = isObservable;
var get = (value, getFunction = true) => {
  const is2 = getFunction ? isFunction : is_observable_default;
  if (is2(value)) {
    return value();
  } else {
    return value;
  }
};
var get_default = get;

class Suspense extends owner_default {
  parent = OWNER;
  context = { ...OWNER.context, [SYMBOL_SUSPENSE]: this };
  observable;
  suspended;
  constructor() {
    super();
    lazyArrayPush(this.parent, "suspenses", this);
    this.suspended = OWNER.get(SYMBOL_SUSPENSE)?.suspended || 0;
  }
  toggle(force) {
    if (!this.suspended && !force)
      return;
    const suspendedPrev = this.suspended;
    const suspendedNext = suspendedPrev + (force ? 1 : -1);
    this.suspended = suspendedNext;
    if (!!suspendedPrev === !!suspendedNext)
      return;
    this.observable?.set(!!suspendedNext);
    const notifyOwner = (owner6) => {
      lazyArrayEach(owner6.contexts, notifyOwner);
      lazyArrayEach(owner6.observers, notifyObserver);
      lazyArrayEach(owner6.suspenses, notifySuspense);
      lazySetEach(owner6.roots, notifyRoot);
    };
    const notifyObserver = (observer3) => {
      if (observer3 instanceof effect_default) {
        if (observer3.status === DIRTY_MAYBE_YES || observer3.status === DIRTY_YES) {
          if (observer3.init) {
            observer3.update();
          } else {
            observer3.schedule();
          }
        }
      }
      notifyOwner(observer3);
    };
    const notifyRoot = (root2) => {
      if (isFunction(root2)) {
        root2().forEach(notifyOwner);
      } else {
        notifyOwner(root2);
      }
    };
    const notifySuspense = (suspense) => {
      suspense.toggle(force);
    };
    notifyOwner(this);
  }
  wrap(fn) {
    return super.wrap(fn, this, undefined);
  }
}
var suspense_default = Suspense;
var suspense2 = (when, fn) => {
  const suspense3 = new suspense_default;
  const condition = boolean_default(when);
  const toggle = () => suspense3.toggle(get_default(condition));
  effect_default2(toggle, { sync: true });
  return suspense3.wrap(fn);
};
var suspense_default2 = suspense2;
var DUMMY_INDEX2 = frozen(-1);

class MappedRoot2 extends root_default {
  constructor() {
    super(...arguments);
  }
  index;
  value;
  suspended;
  result;
}

class CacheUnkeyed {
  parent = OWNER;
  suspense = OWNER.get(SYMBOL_SUSPENSE);
  fn;
  fnWithIndex;
  cache = new Map;
  pool = [];
  poolMaxSize = 0;
  pooled;
  constructor(fn, pooled) {
    this.fn = fn;
    this.fnWithIndex = fn.length > 1;
    this.pooled = pooled;
    if (this.suspense) {
      lazySetAdd(this.parent, "roots", this.roots);
    }
  }
  cleanup = () => {
    let pooled = 0;
    let poolable = Math.max(0, this.pooled ? this.poolMaxSize - this.pool.length : 0);
    this.cache.forEach((mapped) => {
      if (poolable > 0 && pooled++ < poolable) {
        mapped.suspended?.set(true);
        this.pool.push(mapped);
      } else {
        mapped.dispose(true);
      }
    });
  };
  dispose = () => {
    if (this.suspense) {
      lazySetDelete(this.parent, "roots", this.roots);
    }
    this.cache.forEach((mapped) => {
      mapped.dispose(true);
    });
    this.pool.forEach((mapped) => {
      mapped.dispose(true);
    });
  };
  map = (values) => {
    const { cache, fn, fnWithIndex } = this;
    const cacheNext = new Map;
    const results = new Array(values.length);
    const pool = this.pool;
    const pooled = this.pooled;
    let resultsCached = true;
    let resultsUncached = true;
    let leftovers = [];
    if (cache.size) {
      for (let i = 0, l = values.length;i < l; i++) {
        const value = values[i];
        const cached = cache.get(value);
        if (cached) {
          resultsUncached = false;
          cache.delete(value);
          cacheNext.set(value, cached);
          cached.index?.set(i);
          results[i] = cached.result;
        } else {
          leftovers.push(i);
        }
      }
    } else {
      leftovers = new Array(results.length);
    }
    outer:
      for (let i = 0, l = leftovers.length;i < l; i++) {
        const index = leftovers[i] || i;
        const value = values[index];
        const isDuplicate = cacheNext.has(value);
        if (!isDuplicate) {
          for (const [key, mapped2] of cache.entries()) {
            cache.delete(key);
            cacheNext.set(value, mapped2);
            mapped2.index?.set(index);
            mapped2.value?.set(value);
            results[index] = mapped2.result;
            continue outer;
          }
        }
        resultsCached = false;
        let mapped;
        if (pooled && pool.length) {
          mapped = pool.pop();
          mapped.index?.set(index);
          mapped.value?.set(value);
          mapped.suspended?.set(false);
          results[index] = mapped.result;
        } else {
          mapped = new MappedRoot2(false);
          mapped.wrap(() => {
            let $index = DUMMY_INDEX2;
            if (fnWithIndex) {
              mapped.index = new observable_default(index);
              $index = readable(mapped.index);
            }
            const observable5 = mapped.value = new observable_default(value);
            const suspended = pooled ? new observable_default(false) : undefined;
            const $value = memo_default2(() => get_default(observable5.get()));
            const result = results[index] = suspended ? suspense_default2(() => suspended.get(), () => resolve_default(fn($value, $index))) : resolve_default(fn($value, $index));
            mapped.value = observable5;
            mapped.result = result;
            mapped.suspended = suspended;
          });
        }
        if (isDuplicate) {
          cleanup_default(() => mapped.dispose(true));
        } else {
          cacheNext.set(value, mapped);
        }
      }
    this.poolMaxSize = Math.max(this.poolMaxSize, results.length);
    this.cleanup();
    this.cache = cacheNext;
    if (resultsCached) {
      results[SYMBOL_CACHED] = true;
    }
    if (resultsUncached) {
      results[SYMBOL_UNCACHED] = true;
    }
    return results;
  };
  roots = () => {
    return [...this.cache.values(), ...this.pool.values()];
  };
}
var for_cache_unkeyed_default = CacheUnkeyed;
var isStore = (value) => {
  return isObject(value) && SYMBOL_STORE in value;
};
var is_store_default = isStore;
var untrackImpl = (fn) => {
  if (isFunction(fn)) {
    const observerPrev = OBSERVER;
    if (observerPrev) {
      try {
        setObserver(undefined);
        return fn();
      } finally {
        setObserver(observerPrev);
      }
    } else {
      return fn();
    }
  } else {
    return fn;
  }
};
var untrack = untrackImpl;
var untrack_default = untrack;
var _for = function(values, fn, fallback = [], options) {
  if (isArray(values) && !is_store_default(values)) {
    const isUnkeyed = !!options?.unkeyed;
    return frozen(untrack_default(() => {
      if (values.length) {
        return values.map((value, index) => {
          return resolve_default(fn(isUnkeyed && !is_observable_default(value) ? frozen(value) : value, index));
        });
      } else {
        return resolve_default(fallback);
      }
    }));
  } else {
    const { dispose, map } = options?.unkeyed ? new for_cache_unkeyed_default(fn, !!options.pooled) : new for_cache_keyed_default(fn);
    cleanup_default(dispose);
    const value = memo_default2(() => {
      return get_default(values) ?? [];
    }, {
      equals: (next, prev) => {
        return !!next && !!prev && !next.length && !prev.length && !is_store_default(next) && !is_store_default(prev);
      }
    });
    return memo_default2(() => {
      const array = value();
      if (is_store_default(array)) {
        array[SYMBOL_STORE_VALUES];
      }
      return untrack_default(() => {
        const results = map(array);
        return results?.length ? results : resolve_default(fallback);
      });
    }, {
      equals: (next, prev) => {
        return isArray(next) && !!next[SYMBOL_CACHED] && isArray(prev) && isEqual(next, prev);
      }
    });
  }
};
var for_default = _for;
var warmup = (value) => {
  untrack_default(value);
  return value;
};
var warmup_default = warmup;
var _switch = function(when, values, fallback) {
  const isDynamic = isFunction(when) && !is_observable_frozen_default(when) && !is_untracked_default(when);
  if (isDynamic) {
    if (is_observable_boolean_default(when)) {
      return memo_default2(() => resolve_default(match(when(), values, fallback)));
    }
    const value = warmup_default(memo_default2(() => match(when(), values, fallback)));
    if (is_observable_frozen_default(value)) {
      return frozen(resolve_default(value()));
    } else {
      return memo_default2(() => resolve_default(get_default(value)));
    }
  } else {
    const value = match(get_default(when), values, fallback);
    return frozen(resolve_default(value));
  }
};
var match = (condition, values, fallback) => {
  for (let i = 0, l = values.length;i < l; i++) {
    const value = values[i];
    if (value.length === 1)
      return value[0];
    if (is(value[0], condition))
      return value[1];
  }
  return fallback;
};
var switch_default = _switch;
var ternary = (when, valueTrue, valueFalse) => {
  const condition = boolean_default(when);
  return switch_default(condition, [[true, valueTrue], [valueFalse]]);
};
var ternary_default = ternary;
var _if = function(when, valueTrue, valueFalse) {
  return ternary_default(when, valueTrue, valueFalse);
};
var if_default = _if;
var isBatching = () => {
  return !!BATCH || scheduler_async_default.queued || scheduler_async_default.locked || scheduler_sync_default.locked;
};
var is_batching_default = isBatching;
var observable6 = (value, options) => {
  return writable(new observable_default(value, options));
};
var observable_default2 = observable6;
var owner6 = () => {
  const isSuperRoot = OWNER instanceof superroot_default;
  const isRoot = OWNER instanceof root_default;
  const isSuspense = OWNER instanceof suspense_default;
  const isComputation = OWNER instanceof observer_default;
  return { isSuperRoot, isRoot, isSuspense, isComputation };
};
var owner_default2 = owner6;
var isObservableWritable = (value) => {
  return isFunction(value) && SYMBOL_OBSERVABLE_WRITABLE in value;
};
var is_observable_writable_default = isObservableWritable;
var target = (observable7) => {
  if (isFunction(observable7)) {
    return observable7[SYMBOL_OBSERVABLE_READABLE] || observable7[SYMBOL_OBSERVABLE_WRITABLE] || UNAVAILABLE;
  } else {
    return observable7;
  }
};
var target_default = target;
var readonly = (observable7) => {
  if (is_observable_writable_default(observable7)) {
    return readable(target_default(observable7));
  } else {
    return observable7;
  }
};
var readonly_default = readonly;
var root5 = (fn) => {
  return new root_default(true).wrap(fn);
};
var root_default2 = root5;

class DisposableMap extends Map {
  constructor() {
    super(...arguments);
  }
  disposed = false;
}

class SelectedObservable extends observable_default {
  constructor() {
    super(...arguments);
  }
  count = 1;
  selecteds;
  source;
  call() {
    if (this.selecteds.disposed)
      return;
    this.count -= 1;
    if (this.count)
      return;
    this.selecteds.delete(this.source);
  }
}
var selector = (source) => {
  source = warmup_default(memo_default2(source));
  if (is_observable_frozen_default(source)) {
    const sourceValue = untrack_default(source);
    return (value) => {
      return value === sourceValue ? OBSERVABLE_TRUE : OBSERVABLE_FALSE;
    };
  }
  let selecteds = new DisposableMap;
  let selectedValue = untrack_default(source);
  effect_default2(() => {
    const valuePrev = selectedValue;
    const valueNext = source();
    if (is(valuePrev, valueNext))
      return;
    selectedValue = valueNext;
    selecteds.get(valuePrev)?.set(false);
    selecteds.get(valueNext)?.set(true);
  }, { suspense: false, sync: true });
  const cleanupAll = () => {
    selecteds.disposed = true;
  };
  cleanup_default(cleanupAll);
  return (value) => {
    let selected = selecteds.get(value);
    if (selected) {
      selected.count += 1;
    } else {
      selected = new SelectedObservable(value === selectedValue);
      selected.selecteds = selecteds;
      selected.source = value;
      selecteds.set(value, selected);
    }
    cleanup_default(selected);
    return readable(selected);
  };
};
var selector_default = selector;

class StoreMap extends Map {
  constructor() {
    super(...arguments);
  }
  insert(key, value) {
    super.set(key, value);
    return value;
  }
}

class StoreCleanable {
  count = 0;
  listen() {
    this.count += 1;
    cleanup_default(this);
  }
  call() {
    this.count -= 1;
    if (this.count)
      return;
    this.dispose();
  }
  dispose() {
  }
}

class StoreKeys extends StoreCleanable {
  parent;
  observable9;
  constructor(parent, observable9) {
    super();
    this.parent = parent;
    this.observable = observable9;
  }
  dispose() {
    this.parent.keys = undefined;
  }
}

class StoreValues extends StoreCleanable {
  parent;
  observable9;
  constructor(parent, observable9) {
    super();
    this.parent = parent;
    this.observable = observable9;
  }
  dispose() {
    this.parent.values = undefined;
  }
}

class StoreHas extends StoreCleanable {
  parent;
  key;
  observable9;
  constructor(parent, key, observable9) {
    super();
    this.parent = parent;
    this.key = key;
    this.observable = observable9;
  }
  dispose() {
    this.parent.has?.delete(this.key);
  }
}

class StoreProperty extends StoreCleanable {
  parent;
  key;
  observable9;
  node;
  constructor(parent, key, observable9, node) {
    super();
    this.parent = parent;
    this.key = key;
    this.observable = observable9;
    this.node = node;
  }
  dispose() {
    this.parent.properties?.delete(this.key);
  }
}
var StoreListenersRegular = {
  active: 0,
  listeners: new Set,
  nodes: new Set,
  prepare: () => {
    const { listeners, nodes } = StoreListenersRegular;
    const traversed = new Set;
    const traverse = (node) => {
      if (traversed.has(node))
        return;
      traversed.add(node);
      lazySetEach(node.parents, traverse);
      lazySetEach(node.listenersRegular, (listener) => {
        listeners.add(listener);
      });
    };
    nodes.forEach(traverse);
    return () => {
      listeners.forEach((listener) => {
        listener();
      });
    };
  },
  register: (node) => {
    StoreListenersRegular.nodes.add(node);
    StoreScheduler.schedule();
  },
  reset: () => {
    StoreListenersRegular.listeners = new Set;
    StoreListenersRegular.nodes = new Set;
  }
};
var StoreListenersRoots = {
  active: 0,
  nodes: new Map,
  prepare: () => {
    const { nodes } = StoreListenersRoots;
    return () => {
      nodes.forEach((rootsSet, store) => {
        const roots = Array.from(rootsSet);
        lazySetEach(store.listenersRoots, (listener) => {
          listener(roots);
        });
      });
    };
  },
  register: (store, root6) => {
    const roots = StoreListenersRoots.nodes.get(store) || new Set;
    roots.add(root6);
    StoreListenersRoots.nodes.set(store, roots);
    StoreScheduler.schedule();
  },
  registerWith: (current, parent, key) => {
    if (!parent.parents) {
      const root6 = current?.store || untrack_default(() => parent.store[key]);
      StoreListenersRoots.register(parent, root6);
    } else {
      const traversed = new Set;
      const traverse = (node) => {
        if (traversed.has(node))
          return;
        traversed.add(node);
        lazySetEach(node.parents, (parent2) => {
          if (!parent2.parents) {
            StoreListenersRoots.register(parent2, node.store);
          }
          traverse(parent2);
        });
      };
      traverse(current || parent);
    }
  },
  reset: () => {
    StoreListenersRoots.nodes = new Map;
  }
};
var StoreScheduler = {
  active: false,
  flush: () => {
    const flushRegular = StoreListenersRegular.prepare();
    const flushRoots = StoreListenersRoots.prepare();
    StoreScheduler.reset();
    flushRegular();
    flushRoots();
  },
  flushIfNotBatching: () => {
    if (is_batching_default()) {
      if (BATCH) {
        BATCH.finally(StoreScheduler.flushIfNotBatching);
      } else {
        setTimeout(StoreScheduler.flushIfNotBatching, 0);
      }
    } else {
      StoreScheduler.flush();
    }
  },
  reset: () => {
    StoreScheduler.active = false;
    StoreListenersRegular.reset();
    StoreListenersRoots.reset();
  },
  schedule: () => {
    if (StoreScheduler.active)
      return;
    StoreScheduler.active = true;
    queueMicrotask(StoreScheduler.flushIfNotBatching);
  }
};
var NODES = new WeakMap;
var SPECIAL_SYMBOLS = new Set([
  SYMBOL_STORE,
  SYMBOL_STORE_KEYS,
  SYMBOL_STORE_OBSERVABLE,
  SYMBOL_STORE_TARGET,
  SYMBOL_STORE_VALUES
]);
var UNREACTIVE_KEYS = new Set([
  "__proto__",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
  "prototype",
  "constructor",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
  "toSource",
  "toString",
  "valueOf"
]);
var STORE_TRAPS = {
  get: (target3, key) => {
    if (SPECIAL_SYMBOLS.has(key)) {
      if (key === SYMBOL_STORE)
        return true;
      if (key === SYMBOL_STORE_TARGET)
        return target3;
      if (key === SYMBOL_STORE_KEYS) {
        if (isListenable()) {
          const node2 = getNodeExisting(target3);
          node2.keys ||= getNodeKeys(node2);
          node2.keys.listen();
          node2.keys.observable.get();
        }
        return;
      }
      if (key === SYMBOL_STORE_VALUES) {
        if (isListenable()) {
          const node2 = getNodeExisting(target3);
          node2.values ||= getNodeValues(node2);
          node2.values.listen();
          node2.values.observable.get();
        }
        return;
      }
      if (key === SYMBOL_STORE_OBSERVABLE) {
        return (key2) => {
          key2 = typeof key2 === "number" ? String(key2) : key2;
          const node2 = getNodeExisting(target3);
          const getter2 = node2.getters?.get(key2);
          if (getter2)
            return getter2.bind(node2.store);
          node2.properties ||= new StoreMap;
          const value2 = target3[key2];
          const property2 = node2.properties.get(key2) || node2.properties.insert(key2, getNodeProperty(node2, key2, value2));
          const options = node2.equals ? { equals: node2.equals } : undefined;
          property2.observable ||= getNodeObservable(node2, value2, options);
          const observable9 = readable(property2.observable);
          return observable9;
        };
      }
    }
    if (UNREACTIVE_KEYS.has(key))
      return target3[key];
    const node = getNodeExisting(target3);
    const getter = node.getters?.get(key);
    const value = getter || target3[key];
    node.properties ||= new StoreMap;
    const listenable = isListenable();
    const proxiable = isProxiable(value);
    const property = listenable || proxiable ? node.properties.get(key) || node.properties.insert(key, getNodeProperty(node, key, value)) : undefined;
    if (property?.node) {
      lazySetAdd(property.node, "parents", node);
    }
    if (property && listenable) {
      const options = node.equals ? { equals: node.equals } : undefined;
      property.listen();
      property.observable ||= getNodeObservable(node, value, options);
      property.observable.get();
    }
    if (getter) {
      return getter.call(node.store);
    } else {
      if (typeof value === "function" && value === Array.prototype[key]) {
        return function() {
          return value.apply(node.store, arguments);
        };
      }
      return property?.node?.store || value;
    }
  },
  set: (target3, key, value) => {
    value = getTarget(value);
    const node = getNodeExisting(target3);
    const setter = node.setters?.get(key);
    if (setter) {
      setter.call(node.store, value);
    } else {
      const valuePrev = target3[key];
      const hadProperty = !!valuePrev || key in target3;
      const equals = node.equals || is;
      if (hadProperty && equals(value, valuePrev) && (key !== "length" || !Array.isArray(target3)))
        return true;
      target3[key] = value;
      node.values?.observable.set(0);
      if (!hadProperty) {
        node.keys?.observable.set(0);
        node.has?.get(key)?.observable.set(true);
      }
      const property = node.properties?.get(key);
      if (property?.node) {
        lazySetDelete(property.node, "parents", node);
      }
      if (property) {
        property.observable?.set(value);
        property.node = isProxiable(value) ? NODES.get(value) || getNode(value, node) : undefined;
      }
      if (property?.node) {
        lazySetAdd(property.node, "parents", node);
      }
      if (StoreListenersRoots.active) {
        StoreListenersRoots.registerWith(property?.node, node, key);
      }
      if (StoreListenersRegular.active) {
        StoreListenersRegular.register(node);
      }
    }
    return true;
  },
  deleteProperty: (target3, key) => {
    const hasProperty = key in target3;
    if (!hasProperty)
      return true;
    const deleted = Reflect.deleteProperty(target3, key);
    if (!deleted)
      return false;
    const node = getNodeExisting(target3);
    node.keys?.observable.set(0);
    node.values?.observable.set(0);
    node.has?.get(key)?.observable.set(false);
    const property = node.properties?.get(key);
    if (StoreListenersRoots.active) {
      StoreListenersRoots.registerWith(property?.node, node, key);
    }
    if (property?.node) {
      lazySetDelete(property.node, "parents", node);
    }
    if (property) {
      property.observable?.set(undefined);
      property.node = undefined;
    }
    if (StoreListenersRegular.active) {
      StoreListenersRegular.register(node);
    }
    return true;
  },
  defineProperty: (target3, key, descriptor) => {
    const node = getNodeExisting(target3);
    const equals = node.equals || is;
    const hadProperty = key in target3;
    const descriptorPrev = Reflect.getOwnPropertyDescriptor(target3, key);
    if ("value" in descriptor && is_store_default(descriptor.value)) {
      descriptor = { ...descriptor, value: getTarget(descriptor.value) };
    }
    if (descriptorPrev && isEqualDescriptor(descriptorPrev, descriptor, equals))
      return true;
    const defined = Reflect.defineProperty(target3, key, descriptor);
    if (!defined)
      return false;
    if (!descriptor.get) {
      node.getters?.delete(key);
    } else if (descriptor.get) {
      node.getters ||= new StoreMap;
      node.getters.set(key, descriptor.get);
    }
    if (!descriptor.set) {
      node.setters?.delete(key);
    } else if (descriptor.set) {
      node.setters ||= new StoreMap;
      node.setters.set(key, descriptor.set);
    }
    if (hadProperty !== !!descriptor.enumerable) {
      node.keys?.observable.set(0);
    }
    node.has?.get(key)?.observable.set(true);
    const property = node.properties?.get(key);
    if (StoreListenersRoots.active) {
      StoreListenersRoots.registerWith(property?.node, node, key);
    }
    if (property?.node) {
      lazySetDelete(property.node, "parents", node);
    }
    if (property) {
      if ("get" in descriptor) {
        property.observable?.set(descriptor.get);
        property.node = undefined;
      } else {
        const value = descriptor.value;
        property.observable?.set(value);
        property.node = isProxiable(value) ? NODES.get(value) || getNode(value, node) : undefined;
      }
    }
    if (property?.node) {
      lazySetAdd(property.node, "parents", node);
    }
    if (StoreListenersRoots.active) {
      StoreListenersRoots.registerWith(property?.node, node, key);
    }
    if (StoreListenersRegular.active) {
      StoreListenersRegular.register(node);
    }
    return true;
  },
  has: (target3, key) => {
    if (key === SYMBOL_STORE)
      return true;
    if (key === SYMBOL_STORE_TARGET)
      return true;
    const value = key in target3;
    if (isListenable()) {
      const node = getNodeExisting(target3);
      node.has ||= new StoreMap;
      const has = node.has.get(key) || node.has.insert(key, getNodeHas(node, key, value));
      has.listen();
      has.observable.get();
    }
    return value;
  },
  ownKeys: (target3) => {
    const keys = Reflect.ownKeys(target3);
    if (isListenable()) {
      const node = getNodeExisting(target3);
      node.keys ||= getNodeKeys(node);
      node.keys.listen();
      node.keys.observable.get();
    }
    return keys;
  }
};
var STORE_UNTRACK_TRAPS = {
  has: (target3, key) => {
    if (key === SYMBOL_STORE_UNTRACKED)
      return true;
    return key in target3;
  }
};
var getNode = (value, parent, equals) => {
  const store = new Proxy(value, STORE_TRAPS);
  const gettersAndSetters = getGettersAndSetters(value);
  const node = { parents: parent, store };
  if (gettersAndSetters) {
    const { getters, setters } = gettersAndSetters;
    if (getters)
      node.getters = getters;
    if (setters)
      node.setters = setters;
  }
  if (equals === false) {
    node.equals = nope;
  } else if (equals) {
    node.equals = equals;
  } else if (parent?.equals) {
    node.equals = parent.equals;
  }
  NODES.set(value, node);
  return node;
};
var getNodeExisting = (value) => {
  const node = NODES.get(value);
  if (!node)
    throw new Error("Impossible");
  return node;
};
var getNodeFromStore = (store) => {
  return getNodeExisting(getTarget(store));
};
var getNodeKeys = (node) => {
  const observable9 = getNodeObservable(node, 0, { equals: false });
  const keys = new StoreKeys(node, observable9);
  return keys;
};
var getNodeValues = (node) => {
  const observable9 = getNodeObservable(node, 0, { equals: false });
  const values = new StoreValues(node, observable9);
  return values;
};
var getNodeHas = (node, key, value) => {
  const observable9 = getNodeObservable(node, value);
  const has = new StoreHas(node, key, observable9);
  return has;
};
var getNodeObservable = (node, value, options) => {
  return new observable_default(value, options);
};
var getNodeProperty = (node, key, value) => {
  const observable9 = undefined;
  const propertyNode = isProxiable(value) ? NODES.get(value) || getNode(value, node) : undefined;
  const property = new StoreProperty(node, key, observable9, propertyNode);
  node.properties ||= new StoreMap;
  node.properties.set(key, property);
  return property;
};
var getGettersAndSetters = (value) => {
  if (isArray(value))
    return;
  let getters;
  let setters;
  const keys = Object.keys(value);
  for (let i = 0, l = keys.length;i < l; i++) {
    const key = keys[i];
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor)
      continue;
    const { get: get6, set } = descriptor;
    if (get6) {
      getters ||= new StoreMap;
      getters.set(key, get6);
    }
    if (set) {
      setters ||= new StoreMap;
      setters.set(key, set);
    }
  }
  if (!getters && !setters)
    return;
  return { getters, setters };
};
var getStore = (value, options) => {
  if (is_store_default(value))
    return value;
  const node = NODES.get(value) || getNode(value, undefined, options?.equals);
  return node.store;
};
var getTarget = (value) => {
  if (is_store_default(value))
    return value[SYMBOL_STORE_TARGET];
  return value;
};
var getUntracked = (value) => {
  if (!isObject(value))
    return value;
  if (isUntracked2(value))
    return value;
  return new Proxy(value, STORE_UNTRACK_TRAPS);
};
var isEqualDescriptor = (a, b, equals) => {
  return !!a.configurable === !!b.configurable && !!a.enumerable === !!b.enumerable && !!a.writable === !!b.writable && equals(a.value, b.value) && a.get === b.get && a.set === b.set;
};
var isListenable = () => {
  return !!OBSERVER;
};
var isProxiable = (value) => {
  if (value === null || typeof value !== "object")
    return false;
  if (SYMBOL_STORE in value)
    return true;
  if (SYMBOL_STORE_UNTRACKED in value)
    return false;
  if (isArray(value))
    return true;
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null)
    return true;
  return Object.getPrototypeOf(prototype) === null;
};
var isUntracked2 = (value) => {
  if (value === null || typeof value !== "object")
    return false;
  return SYMBOL_STORE_UNTRACKED in value;
};
var store = (value, options) => {
  if (!isObject(value))
    return value;
  if (isUntracked2(value))
    return value;
  return getStore(value, options);
};
store.on = (target3, listener) => {
  const targets = is_store_default(target3) ? [target3] : castArray(target3);
  const selectors = targets.filter(isFunction);
  const nodes = targets.filter(is_store_default).map(getNodeFromStore);
  StoreListenersRegular.active += 1;
  const disposers = selectors.map((selector2) => {
    let inited = false;
    return effect_default2(() => {
      if (inited) {
        StoreListenersRegular.listeners.add(listener);
        StoreScheduler.schedule();
      }
      inited = true;
      selector2();
    }, { suspense: false, sync: true });
  });
  nodes.forEach((node) => {
    lazySetAdd(node, "listenersRegular", listener);
  });
  return () => {
    StoreListenersRegular.active -= 1;
    disposers.forEach((disposer) => {
      disposer();
    });
    nodes.forEach((node) => {
      lazySetDelete(node, "listenersRegular", listener);
    });
  };
};
store._onRoots = (target3, listener) => {
  if (!is_store_default(target3))
    return noop;
  const node = getNodeFromStore(target3);
  if (node.parents)
    throw new Error("Only top-level stores are supported");
  StoreListenersRoots.active += 1;
  lazySetAdd(node, "listenersRoots", listener);
  return () => {
    StoreListenersRoots.active -= 1;
    lazySetDelete(node, "listenersRoots", listener);
  };
};
store.reconcile = (() => {
  const getType = (value) => {
    if (isArray(value))
      return 1;
    if (isProxiable(value))
      return 2;
    return 0;
  };
  const reconcileOuter = (prev, next) => {
    const uprev = getTarget(prev);
    const unext = getTarget(next);
    reconcileInner(prev, next);
    const prevType = getType(uprev);
    const nextType = getType(unext);
    if (prevType === 1 || nextType === 1) {
      prev.length = next.length;
    }
    return prev;
  };
  const reconcileInner = (prev, next) => {
    const uprev = getTarget(prev);
    const unext = getTarget(next);
    const prevKeys = Object.keys(uprev);
    const nextKeys = Object.keys(unext);
    for (let i = 0, l = nextKeys.length;i < l; i++) {
      const key = nextKeys[i];
      const prevValue = uprev[key];
      const nextValue = unext[key];
      if (!is(prevValue, nextValue)) {
        const prevType = getType(prevValue);
        const nextType = getType(nextValue);
        if (prevType && prevType === nextType) {
          reconcileInner(prev[key], nextValue);
          if (prevType === 1) {
            prev[key].length = nextValue.length;
          }
        } else {
          prev[key] = nextValue;
        }
      } else if (prevValue === undefined && !(key in uprev)) {
        prev[key] = undefined;
      }
    }
    for (let i = 0, l = prevKeys.length;i < l; i++) {
      const key = prevKeys[i];
      if (!(key in unext)) {
        delete prev[key];
      }
    }
    return prev;
  };
  const reconcile = (prev, next) => {
    return untrack_default(() => {
      return reconcileOuter(prev, next);
    });
  };
  return reconcile;
})();
store.untrack = (value) => {
  return getUntracked(value);
};
store.unwrap = (value) => {
  return getTarget(value);
};
var store_default = store;
var suspended = () => {
  const suspense5 = OWNER.get(SYMBOL_SUSPENSE);
  if (!suspense5)
    return OBSERVABLE_FALSE;
  const observable10 = suspense5.observable ||= new observable_default(!!suspense5.suspended);
  return readable(observable10);
};
var suspended_default = suspended;
var tick = () => {
  scheduler_async_default.flush();
};
var tick_default = tick;
var tryCatch = (value, fn) => {
  const observable11 = observable_default2();
  return memo_default2(() => {
    const error = observable11();
    if (error) {
      const reset = () => observable11(undefined);
      const options = { error, reset };
      return resolve_default(fn(options));
    } else {
      OWNER.errorHandler = observable11;
      return resolve_default(value);
    }
  });
};
var try_catch_default = tryCatch;
var untracked = (fn) => {
  const untracked2 = isFunction(fn) ? (...args) => untrack_default(() => fn(...args)) : () => fn;
  untracked2[SYMBOL_UNTRACKED] = true;
  return untracked2;
};
var untracked_default = untracked;
var _with = () => {
  const owner7 = OWNER;
  const observer4 = OBSERVER;
  return (fn) => {
    return owner7.wrap(() => fn(), owner7, observer4);
  };
};
var with_default = _with;
var $ = function(value, options) {
  return writable(new observable_default(value, options));
};
$.batch = batch_default;
$.boolean = boolean_default;
$.cleanup = cleanup_default;
$.context = context_default2;
$.disposed = disposed_default;
$.effect = effect_default2;
$.for = for_default;
$.get = get_default;
$.if = if_default;
$.isBatching = is_batching_default;
$.isObservable = is_observable_default;
$.isStore = is_store_default;
$.memo = memo_default2;
$.observable = observable_default2;
$.owner = owner_default2;
$.readonly = readonly_default;
$.resolve = resolve_default;
$.root = root_default2;
$.selector = selector_default;
$.store = store_default;
$.suspended = suspended_default;
$.suspense = suspense_default2;
$.switch = switch_default;
$.ternary = ternary_default;
$.tick = tick_default;
$.tryCatch = try_catch_default;
$.untrack = untrack_default;
$.untracked = untracked_default;
$.with = with_default;
var $_default = $;
var src_default = $_default;

// node_modules/@solenopsys/converged-renderer/dist/index.js
var IS_BROWSER = !!globalThis.CDATASection?.toString?.().match(/^\s*function\s+CDATASection\s*\(\s*\)\s*\{\s*\[native code\]\s*\}\s*$/);
var use_memo_default = memo_default2;
var untrack_default2 = untrack_default;
var CONTEXTS_DATA = new WeakMap;
var DIRECTIVES = {};
var SYMBOL_SUSPENSE2 = Symbol("Suspense");
var SYMBOL_SUSPENSE_COLLECTOR = Symbol("Suspense.Collector");
var SYMBOL_TEMPLATE_ACCESSOR = Symbol("Template.Accessor");
var SYMBOLS_DIRECTIVES = {};
var wrapElement = (element) => {
  element[SYMBOL_UNTRACKED_UNWRAPPED] = true;
  return element;
};
var wrap_element_default = wrapElement;
var createComment = document.createComment.bind(document, "");
var createHTMLNode = document.createElement.bind(document);
var createSVGNode = document.createElementNS.bind(document, "http://www.w3.org/2000/svg");
var createText = document.createTextNode.bind(document);
var { assign } = Object;
var castArray2 = (value) => {
  return isArray2(value) ? value : [value];
};
var flatten = (arr) => {
  for (let i = 0, l = arr.length;i < l; i++) {
    if (!isArray2(arr[i]))
      continue;
    return arr.flat(Infinity);
  }
  return arr;
};
var indexOf = (() => {
  const _indexOf = Array.prototype.indexOf;
  return (arr, value) => {
    return _indexOf.call(arr, value);
  };
})();
var { isArray: isArray2 } = Array;
var isBoolean = (value) => {
  return typeof value === "boolean";
};
var isComponent = (value) => {
  return isFunction2(value) && SYMBOL_UNTRACKED_UNWRAPPED in value;
};
var isFunction2 = (value) => {
  return typeof value === "function";
};
var isFunctionReactive = (value) => {
  return !((SYMBOL_UNTRACKED in value) || (SYMBOL_UNTRACKED_UNWRAPPED in value) || (SYMBOL_OBSERVABLE_FROZEN in value) || value[SYMBOL_OBSERVABLE_READABLE]?.parent?.disposed);
};
var isNil = (value) => {
  return value === null || value === undefined;
};
var isNode = (value) => {
  return value instanceof Node;
};
var isString = (value) => {
  return typeof value === "string";
};
var isSVG = (value) => {
  return !!value["isSVG"];
};
var isSVGElement = (() => {
  const svgRe = /^(t(ext$|s)|s[vwy]|g)|^set|tad|ker|p(at|s)|s(to|c$|ca|k)|r(ec|cl)|ew|us|f($|e|s)|cu|n[ei]|l[ty]|[GOP]/;
  const svgCache = {};
  return (element) => {
    const cached = svgCache[element];
    return cached !== undefined ? cached : svgCache[element] = !element.includes("-") && svgRe.test(element);
  };
})();
var isTemplateAccessor = (value) => {
  return isFunction2(value) && SYMBOL_TEMPLATE_ACCESSOR in value;
};
var isTruthy = (value) => {
  return !!value;
};
var isVoidChild = (value) => {
  return value === null || value === undefined || typeof value === "boolean" || typeof value === "symbol";
};
var use_cleanup_default = cleanup_default;
var use_effect_default = effect_default2;
var is_observable_default2 = is_observable_default;
var SS_default = get_default;
var S_default = observable_default2;
var SuspenseContext = {
  create: () => {
    const count = S_default(0);
    const active = use_memo_default(() => !!count());
    const increment = (nr = 1) => count((prev) => prev + nr);
    const decrement = (nr = -1) => queueMicrotask(() => count((prev) => prev + nr));
    const data = { active, increment, decrement };
    const collector = context_default2(SYMBOL_SUSPENSE_COLLECTOR);
    if (collector) {
      collector?.register(data);
      use_cleanup_default(() => collector.unregister(data));
    }
    return data;
  },
  get: () => {
    return context_default2(SYMBOL_SUSPENSE2);
  },
  wrap: (fn) => {
    const data = SuspenseContext.create();
    return context_default2({ [SYMBOL_SUSPENSE2]: data }, () => {
      return resolve_default(() => fn(data));
    });
  }
};
var suspense_context_default = SuspenseContext;

class SuspenseManager {
  suspenses = new Map;
  change = (suspense22, nr) => {
    const counter2 = this.suspenses.get(suspense22) || 0;
    const counterNext = Math.max(0, counter2 + nr);
    if (counter2 === counterNext)
      return;
    if (counterNext) {
      this.suspenses.set(suspense22, counterNext);
    } else {
      this.suspenses.delete(suspense22);
    }
    if (nr > 0) {
      suspense22.increment(nr);
    } else {
      suspense22.decrement(nr);
    }
  };
  suspend = () => {
    const suspense22 = suspense_context_default.get();
    if (!suspense22)
      return;
    this.change(suspense22, 1);
    use_cleanup_default(() => {
      this.change(suspense22, -1);
    });
  };
  unsuspend = () => {
    this.suspenses.forEach((counter2, suspense22) => {
      this.change(suspense22, -counter2);
    });
  };
}
var options = {
  sync: "init"
};
var useRenderEffect = (fn) => {
  return use_effect_default(fn, options);
};
var use_render_effect_default = useRenderEffect;
var use_untracked_default = untracked_default;
var useCheapDisposed = () => {
  let disposed2 = false;
  const get2 = () => disposed2;
  const set = () => disposed2 = true;
  use_cleanup_default(set);
  return get2;
};
var use_cheap_disposed_default = useCheapDisposed;
var useMicrotask = (fn) => {
  const disposed2 = use_cheap_disposed_default();
  const runWithOwner = with_default();
  queueMicrotask(() => {
    if (disposed2())
      return;
    runWithOwner(fn);
  });
};
var use_microtask_default = useMicrotask;
var is_store_default2 = is_store_default;
var store_default2 = store_default;
var classesToggle = (element, classes, force) => {
  const { className } = element;
  if (isString(className)) {
    if (!className) {
      if (force) {
        element.className = classes;
        return;
      } else {
        return;
      }
    } else if (!force && className === classes) {
      element.className = "";
      return;
    }
  }
  if (classes.includes(" ")) {
    classes.split(" ").forEach((cls) => {
      if (!cls.length)
        return;
      element.classList.toggle(cls, !!force);
    });
  } else {
    element.classList.toggle(classes, !!force);
  }
};
var dummyNode = document.createComment("");
var beforeDummyWrapper = [dummyNode];
var afterDummyWrapper = [dummyNode];
var diff = (parent, before, after, nextSibling) => {
  if (before === after)
    return;
  if (before instanceof Node) {
    if (after instanceof Node) {
      if (before.parentNode === parent) {
        parent.replaceChild(after, before);
        return;
      } else {
      }
    }
    beforeDummyWrapper[0] = before;
    before = beforeDummyWrapper;
  }
  if (after instanceof Node) {
    afterDummyWrapper[0] = after;
    after = afterDummyWrapper;
  }
  const bLength = after.length;
  let aEnd = before.length;
  let bEnd = bLength;
  let aStart = 0;
  let bStart = 0;
  let map = null;
  let removable;
  while (aStart < aEnd || bStart < bEnd) {
    if (aEnd === aStart) {
      const node = bEnd < bLength ? bStart ? after[bStart - 1].nextSibling : after[bEnd - bStart] : nextSibling;
      if (bStart < bEnd) {
        if (node) {
          node.before.apply(node, after.slice(bStart, bEnd));
        } else {
          parent.append.apply(parent, after.slice(bStart, bEnd));
        }
        bStart = bEnd;
      }
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(before[aStart])) {
          removable = before[aStart];
          if (removable.parentNode === parent) {
            parent.removeChild(removable);
          }
        }
        aStart++;
      }
    } else if (before[aStart] === after[bStart]) {
      aStart++;
      bStart++;
    } else if (before[aEnd - 1] === after[bEnd - 1]) {
      aEnd--;
      bEnd--;
    } else if (before[aStart] === after[bEnd - 1] && after[bStart] === before[aEnd - 1]) {
      const node = before[--aEnd].nextSibling;
      parent.insertBefore(after[bStart++], before[aStart++].nextSibling);
      parent.insertBefore(after[--bEnd], node);
      before[aEnd] = after[bEnd];
    } else {
      if (!map) {
        map = new Map;
        let i = bStart;
        while (i < bEnd)
          map.set(after[i], i++);
      }
      if (map.has(before[aStart])) {
        const index = map.get(before[aStart]);
        if (bStart < index && index < bEnd) {
          let i = aStart;
          let sequence = 1;
          while (++i < aEnd && i < bEnd && map.get(before[i]) === index + sequence)
            sequence++;
          if (sequence > index - bStart) {
            const node = before[aStart];
            if (bStart < index) {
              if (node) {
                node.before.apply(node, after.slice(bStart, index));
              } else {
                parent.append.apply(parent, after.slice(bStart, index));
              }
              bStart = index;
            }
          } else {
            parent.replaceChild(after[bStart++], before[aStart++]);
          }
        } else
          aStart++;
      } else {
        removable = before[aStart++];
        if (removable.parentNode === parent) {
          parent.removeChild(removable);
        }
      }
    }
  }
  beforeDummyWrapper[0] = dummyNode;
  afterDummyWrapper[0] = dummyNode;
};
var diff_default = diff;
var NOOP_CHILDREN = [];
var FragmentUtils = {
  make: () => {
    return {
      values: undefined,
      length: 0
    };
  },
  makeWithNode: (node) => {
    return {
      values: node,
      length: 1
    };
  },
  makeWithFragment: (fragment) => {
    return {
      values: fragment,
      fragmented: true,
      length: 1
    };
  },
  getChildrenFragmented: (thiz, children = []) => {
    const { values, length } = thiz;
    if (!length)
      return children;
    if (values instanceof Array) {
      for (let i = 0, l = values.length;i < l; i++) {
        const value = values[i];
        if (value instanceof Node) {
          children.push(value);
        } else {
          FragmentUtils.getChildrenFragmented(value, children);
        }
      }
    } else {
      if (values instanceof Node) {
        children.push(values);
      } else {
        FragmentUtils.getChildrenFragmented(values, children);
      }
    }
    return children;
  },
  getChildren: (thiz) => {
    if (!thiz.length)
      return NOOP_CHILDREN;
    if (!thiz.fragmented)
      return thiz.values;
    if (thiz.length === 1)
      return FragmentUtils.getChildren(thiz.values);
    return FragmentUtils.getChildrenFragmented(thiz);
  },
  pushFragment: (thiz, fragment) => {
    FragmentUtils.pushValue(thiz, fragment);
    thiz.fragmented = true;
  },
  pushNode: (thiz, node) => {
    FragmentUtils.pushValue(thiz, node);
  },
  pushValue: (thiz, value) => {
    const { values, length } = thiz;
    if (length === 0) {
      thiz.values = value;
    } else if (length === 1) {
      thiz.values = [values, value];
    } else {
      values.push(value);
    }
    thiz.length += 1;
  },
  replaceWithNode: (thiz, node) => {
    thiz.values = node;
    delete thiz.fragmented;
    thiz.length = 1;
  },
  replaceWithFragment: (thiz, fragment) => {
    thiz.values = fragment.values;
    thiz.fragmented = fragment.fragmented;
    thiz.length = fragment.length;
  }
};
var fragment_default = FragmentUtils;
function classListernerCallback(element, className) {
  if (plugins.size === 0)
    return;
  plugins.forEach((plugin) => plugin(element, className));
}
var plugins = new Set;
var resolveChild = (value, setter, _dynamic = false) => {
  if (isFunction2(value)) {
    if (!isFunctionReactive(value)) {
      resolveChild(value(), setter, _dynamic);
    } else {
      use_render_effect_default(() => {
        resolveChild(value(), setter, true);
      });
    }
  } else if (isArray2(value)) {
    const [values, hasObservables] = resolveArraysAndStatics(value);
    values[SYMBOL_UNCACHED] = value[SYMBOL_UNCACHED];
    setter(values, hasObservables || _dynamic);
  } else {
    setter(value, _dynamic);
  }
};
var resolveClass = (classes, resolved = {}) => {
  if (isString(classes)) {
    classes.split(/\s+/g).filter(Boolean).filter((cls) => {
      resolved[cls] = true;
    });
  } else if (isFunction2(classes)) {
    resolveClass(classes(), resolved);
  } else if (isArray2(classes)) {
    classes.forEach((cls) => {
      resolveClass(cls, resolved);
    });
  } else if (classes) {
    for (const key in classes) {
      const value = classes[key];
      const isActive = !!SS_default(value);
      if (!isActive)
        continue;
      resolved[key] = true;
    }
  }
  return resolved;
};
var resolveStyle = (styles, resolved = {}) => {
  if (isString(styles)) {
    return styles;
  } else if (isFunction2(styles)) {
    return resolveStyle(styles(), resolved);
  } else if (isArray2(styles)) {
    styles.forEach((style) => {
      resolveStyle(style, resolved);
    });
  } else if (styles) {
    for (const key in styles) {
      const value = styles[key];
      resolved[key] = SS_default(value);
    }
  }
  return resolved;
};
var resolveArraysAndStatics = (() => {
  const DUMMY_RESOLVED = [];
  const resolveArraysAndStaticsInner = (values, resolved, hasObservables) => {
    for (let i = 0, l = values.length;i < l; i++) {
      const value = values[i];
      const type = typeof value;
      if (type === "string" || type === "number" || type === "bigint") {
        if (resolved === DUMMY_RESOLVED)
          resolved = values.slice(0, i);
        resolved.push(createText(value));
      } else if (type === "object" && isArray2(value)) {
        if (resolved === DUMMY_RESOLVED)
          resolved = values.slice(0, i);
        hasObservables = resolveArraysAndStaticsInner(value, resolved, hasObservables)[1];
      } else if (type === "function" && is_observable_default2(value)) {
        if (resolved !== DUMMY_RESOLVED)
          resolved.push(value);
        hasObservables = true;
      } else {
        if (resolved !== DUMMY_RESOLVED)
          resolved.push(value);
      }
    }
    if (resolved === DUMMY_RESOLVED)
      resolved = values;
    return [resolved, hasObservables];
  };
  return (values) => {
    return resolveArraysAndStaticsInner(values, DUMMY_RESOLVED, false);
  };
})();
var setAttributeStatic = (() => {
  const attributesBoolean = new Set([
    "allowfullscreen",
    "async",
    "autofocus",
    "autoplay",
    "checked",
    "controls",
    "default",
    "disabled",
    "formnovalidate",
    "hidden",
    "indeterminate",
    "ismap",
    "loop",
    "multiple",
    "muted",
    "nomodule",
    "novalidate",
    "open",
    "playsinline",
    "readonly",
    "required",
    "reversed",
    "seamless",
    "selected"
  ]);
  const attributeCamelCasedRe = /e(r[HRWrv]|[Vawy])|Con|l(e[Tcs]|c)|s(eP|y)|a(t[rt]|u|v)|Of|Ex|f[XYa]|gt|hR|d[Pg]|t[TXYd]|[UZq]/;
  const attributesCache = {};
  const uppercaseRe = /[A-Z]/g;
  const normalizeKeySvg = (key) => {
    return attributesCache[key] || (attributesCache[key] = attributeCamelCasedRe.test(key) ? key : key.replace(uppercaseRe, (char) => `-${char.toLowerCase()}`));
  };
  return (element, key, value) => {
    if (isSVG(element)) {
      key = key === "xlinkHref" || key === "xlink:href" ? "href" : normalizeKeySvg(key);
      if (isNil(value) || value === false && attributesBoolean.has(key)) {
        element.removeAttribute(key);
      } else {
        element.setAttribute(key, String(value));
      }
    } else {
      if (isNil(value) || value === false && attributesBoolean.has(key)) {
        element.removeAttribute(key);
      } else {
        value = value === true ? "" : String(value);
        element.setAttribute(key, value);
      }
    }
  };
})();
var setAttribute = (element, key, value) => {
  if (isFunction2(value) && isFunctionReactive(value)) {
    use_render_effect_default(() => {
      setAttributeStatic(element, key, value());
    });
  } else {
    setAttributeStatic(element, key, SS_default(value));
  }
};
var setChildReplacementText = (child, childPrev) => {
  if (childPrev.nodeType === 3) {
    childPrev.nodeValue = child;
    return childPrev;
  } else {
    const parent = childPrev.parentElement;
    if (!parent)
      throw new Error("Invalid child replacement");
    const textNode = createText(child);
    parent.replaceChild(textNode, childPrev);
    return textNode;
  }
};
var setChildStatic = (parent, fragment2, fragmentOnly, child, dynamic) => {
  if (!dynamic && child === undefined)
    return;
  const prev = fragment_default.getChildren(fragment2);
  const prevIsArray = prev instanceof Array;
  const prevLength = prevIsArray ? prev.length : 1;
  const prevFirst = prevIsArray ? prev[0] : prev;
  const prevLast = prevIsArray ? prev[prevLength - 1] : prev;
  const prevSibling = prevLast?.nextSibling || null;
  if (prevLength === 0) {
    const type = typeof child;
    if (type === "string" || type === "number" || type === "bigint") {
      const textNode = createText(child);
      if (!fragmentOnly) {
        parent.appendChild(textNode);
      }
      fragment_default.replaceWithNode(fragment2, textNode);
      return;
    } else if (type === "object" && child !== null && typeof child.nodeType === "number") {
      const node = child;
      if (!fragmentOnly) {
        parent.insertBefore(node, null);
      }
      fragment_default.replaceWithNode(fragment2, node);
      return;
    }
  }
  if (prevLength === 1 && prevFirst.parentNode) {
    const type = typeof child;
    if (type === "string" || type === "number" || type === "bigint") {
      const node = setChildReplacementText(String(child), prevFirst);
      fragment_default.replaceWithNode(fragment2, node);
      return;
    }
  }
  const fragmentNext = fragment_default.make();
  const children = Array.isArray(child) ? child : [child];
  for (let i = 0, l = children.length;i < l; i++) {
    const child2 = children[i];
    const type = typeof child2;
    if (type === "string" || type === "number" || type === "bigint") {
      fragment_default.pushNode(fragmentNext, createText(child2));
    } else if (type === "object" && child2 !== null && typeof child2.nodeType === "number") {
      fragment_default.pushNode(fragmentNext, child2);
    } else if (type === "function") {
      const fragment3 = fragment_default.make();
      let childFragmentOnly = !fragmentOnly;
      fragment_default.pushFragment(fragmentNext, fragment3);
      resolveChild(child2, (child3, dynamic2) => {
        const fragmentOnly2 = childFragmentOnly;
        childFragmentOnly = false;
        setChildStatic(parent, fragment3, fragmentOnly2, child3, dynamic2);
      });
    }
  }
  let next = fragment_default.getChildren(fragmentNext);
  let nextLength = fragmentNext.length;
  if (nextLength === 0 && prevLength === 1 && prevFirst.nodeType === 8) {
    return;
  }
  if (!fragmentOnly && (nextLength === 0 || prevLength === 1 && prevFirst.nodeType === 8 || children[SYMBOL_UNCACHED])) {
    const { childNodes } = parent;
    if (childNodes.length === prevLength) {
      parent.textContent = "";
      if (nextLength === 0) {
        const placeholder = fragmentNext.placeholder ||= fragment2.placeholder ||= createComment();
        fragment_default.pushNode(fragmentNext, placeholder);
        if (next !== fragmentNext.values) {
          next = placeholder;
          nextLength += 1;
        }
      }
      if (prevSibling) {
        if (next instanceof Array) {
          prevSibling.before.apply(prevSibling, next);
        } else {
          parent.insertBefore(next, prevSibling);
        }
      } else {
        if (next instanceof Array) {
          parent.append.apply(parent, next);
        } else {
          parent.append(next);
        }
      }
      fragment_default.replaceWithFragment(fragment2, fragmentNext);
      return;
    }
  }
  if (nextLength === 0) {
    const placeholder = fragmentNext.placeholder ||= fragment2.placeholder ||= createComment();
    fragment_default.pushNode(fragmentNext, placeholder);
    if (next !== fragmentNext.values) {
      next = placeholder;
      nextLength += 1;
    }
  }
  if (!fragmentOnly) {
    diff_default(parent, prev, next, prevSibling);
  }
  fragment_default.replaceWithFragment(fragment2, fragmentNext);
};
var setChild = (parent, child, fragment2 = fragment_default.make()) => {
  resolveChild(child, setChildStatic.bind(undefined, parent, fragment2, false));
};
var setClassStatic = classesToggle;
var setClass = (element, key, value) => {
  if (isFunction2(value) && isFunctionReactive(value)) {
    use_render_effect_default(() => {
      setClassStatic(element, key, value());
    });
  } else {
    setClassStatic(element, key, SS_default(value));
  }
};
var setClassBooleanStatic = (element, value, key, keyPrev) => {
  if (keyPrev && keyPrev !== true) {
    setClassStatic(element, keyPrev, false);
  }
  if (key && key !== true) {
    setClassStatic(element, key, value);
  }
};
var setClassBoolean = (element, value, key) => {
  if (isFunction2(key) && isFunctionReactive(key)) {
    let keyPrev;
    use_render_effect_default(() => {
      const keyNext = key();
      setClassBooleanStatic(element, value, keyNext, keyPrev);
      keyPrev = keyNext;
    });
  } else {
    setClassBooleanStatic(element, value, SS_default(key));
  }
};
var setClassesStatic = (element, object, objectPrev) => {
  if (isString(object)) {
    if (isSVG(element)) {
      element.setAttribute("class", object);
    } else {
      classListernerCallback(element, object);
      element.className = object;
    }
  } else {
    if (objectPrev) {
      if (isString(objectPrev)) {
        if (objectPrev) {
          if (isSVG(element)) {
            element.setAttribute("class", "");
          } else {
            element.className = "";
          }
        }
      } else if (isArray2(objectPrev)) {
        objectPrev = store_default2.unwrap(objectPrev);
        for (let i = 0, l = objectPrev.length;i < l; i++) {
          if (!objectPrev[i])
            continue;
          setClassBoolean(element, false, objectPrev[i]);
        }
      } else {
        objectPrev = store_default2.unwrap(objectPrev);
        for (const key in objectPrev) {
          if (object && key in object)
            continue;
          setClass(element, key, false);
        }
      }
    }
    if (isArray2(object)) {
      if (is_store_default2(object)) {
        for (let i = 0, l = object.length;i < l; i++) {
          const fn = untrack_default2(() => isFunction2(object[i]) ? object[i] : object[SYMBOL_STORE_OBSERVABLE](String(i)));
          setClassBoolean(element, true, fn);
        }
      } else {
        for (let i = 0, l = object.length;i < l; i++) {
          if (!object[i])
            continue;
          setClassBoolean(element, true, object[i]);
        }
      }
    } else {
      if (is_store_default2(object)) {
        for (const key in object) {
          const fn = untrack_default2(() => isFunction2(object[key]) ? object[key] : object[SYMBOL_STORE_OBSERVABLE](key));
          setClass(element, key, fn);
        }
      } else {
        for (const key in object) {
          setClass(element, key, object[key]);
        }
      }
    }
  }
};
var setClasses = (element, object) => {
  if (isFunction2(object) || isArray2(object)) {
    let objectPrev;
    use_render_effect_default(() => {
      const objectNext = resolveClass(object);
      setClassesStatic(element, objectNext, objectPrev);
      objectPrev = objectNext;
    });
  } else {
    setClassesStatic(element, object);
  }
};
var setDirective = (element, directive, args) => {
  const symbol = SYMBOLS_DIRECTIVES[directive] || Symbol();
  const data = context_default2(symbol) || DIRECTIVES[symbol];
  if (!data)
    throw new Error(`Directive "${directive}" not found`);
  const call = () => data.fn(element, ...castArray2(args));
  if (data.immediate) {
    call();
  } else {
    use_microtask_default(call);
  }
};
var setEventStatic = (() => {
  const delegatedEvents = {
    onauxclick: ["_onauxclick", false],
    onbeforeinput: ["_onbeforeinput", false],
    onclick: ["_onclick", false],
    ondblclick: ["_ondblclick", false],
    onfocusin: ["_onfocusin", false],
    onfocusout: ["_onfocusout", false],
    oninput: ["_oninput", false],
    onkeydown: ["_onkeydown", false],
    onkeyup: ["_onkeyup", false],
    onmousedown: ["_onmousedown", false],
    onmouseup: ["_onmouseup", false]
  };
  const delegate = (event) => {
    const key = `_${event}`;
    document.addEventListener(event.slice(2), (event2) => {
      const targets = event2.composedPath();
      let target2 = null;
      Object.defineProperty(event2, "currentTarget", {
        configurable: true,
        get() {
          return target2;
        }
      });
      for (let i = 0, l = targets.length;i < l; i++) {
        target2 = targets[i];
        const handler = target2[key];
        if (!handler)
          continue;
        handler(event2);
        if (event2.cancelBubble)
          break;
      }
      target2 = null;
    });
  };
  return (element, event, value) => {
    if (event.startsWith("onmiddleclick")) {
      const _value = value;
      event = `onauxclick${event.slice(13)}`;
      value = _value && ((event2) => event2["button"] === 1 && _value(event2));
    }
    const delegated = delegatedEvents[event];
    if (delegated) {
      if (!delegated[1]) {
        delegated[1] = true;
        delegate(event);
      }
      element[delegated[0]] = value;
    } else if (event.endsWith("passive")) {
      const isCapture = event.endsWith("capturepassive");
      const type = event.slice(2, -7 - (isCapture ? 7 : 0));
      const key = `_${event}`;
      const valuePrev = element[key];
      if (valuePrev)
        element.removeEventListener(type, valuePrev, { capture: isCapture });
      if (value)
        element.addEventListener(type, value, {
          passive: true,
          capture: isCapture
        });
      element[key] = value;
    } else if (event.endsWith("capture")) {
      const type = event.slice(2, -7);
      const key = `_${event}`;
      const valuePrev = element[key];
      if (valuePrev)
        element.removeEventListener(type, valuePrev, { capture: true });
      if (value)
        element.addEventListener(type, value, { capture: true });
      element[key] = value;
    } else {
      element[event] = value;
    }
  };
})();
var setEvent = (element, event, value) => {
  setEventStatic(element, event, value);
};
var setHTMLStatic = (element, value) => {
  element.innerHTML = String(isNil(value) ? "" : value);
};
var setHTML = (element, value) => {
  use_render_effect_default(() => {
    setHTMLStatic(element, SS_default(SS_default(value).__html));
  });
};
var setPropertyStatic = (element, key, value) => {
  if (key === "tabIndex" && isBoolean(value)) {
    value = value ? 0 : undefined;
  }
  if (key === "value") {
    if (element.tagName === "PROGRESS") {
      value ??= null;
    } else if (element.tagName === "SELECT" && !element["_$inited"]) {
      element["_$inited"] = true;
      queueMicrotask(() => element[key] = value);
    }
  }
  try {
    element[key] = value;
    if (isNil(value)) {
      setAttributeStatic(element, key, null);
    }
  } catch {
    setAttributeStatic(element, key, value);
  }
};
var setProperty = (element, key, value) => {
  if (isFunction2(value) && isFunctionReactive(value)) {
    use_render_effect_default(() => {
      setPropertyStatic(element, key, value());
    });
  } else {
    setPropertyStatic(element, key, SS_default(value));
  }
};
var setRef = (element, value) => {
  if (isNil(value))
    return;
  const values = flatten(castArray2(value)).filter(Boolean);
  if (!values.length)
    return;
  use_microtask_default(() => untrack_default2(() => values.forEach((value2) => value2?.(element))));
};
var setStyleStatic = (() => {
  const propertyNonDimensionalRe = /^(-|f[lo].*[^se]$|g.{5,}[^ps]$|z|o[pr]|(W.{5})?[lL]i.*(t|mp)$|an|(bo|s).{4}Im|sca|m.{6}[ds]|ta|c.*[st]$|wido|ini)/i;
  const propertyNonDimensionalCache = {};
  return (element, key, value) => {
    if (key.charCodeAt(0) === 45) {
      if (isNil(value)) {
        element.style.removeProperty(key);
      } else {
        element.style.setProperty(key, String(value));
      }
    } else if (isNil(value)) {
      element.style[key] = null;
    } else {
      element.style[key] = isString(value) || (propertyNonDimensionalCache[key] ||= propertyNonDimensionalRe.test(key)) ? value : `${value}px`;
    }
  };
})();
var setStyle = (element, key, value) => {
  if (isFunction2(value) && isFunctionReactive(value)) {
    use_render_effect_default(() => {
      setStyleStatic(element, key, value());
    });
  } else {
    setStyleStatic(element, key, SS_default(value));
  }
};
var setStylesStatic = (element, object, objectPrev) => {
  if (isString(object)) {
    element.setAttribute("style", object);
  } else {
    if (objectPrev) {
      if (isString(objectPrev)) {
        if (objectPrev) {
          element.style.cssText = "";
        }
      } else {
        objectPrev = store_default2.unwrap(objectPrev);
        for (const key in objectPrev) {
          if (object && key in object)
            continue;
          setStyleStatic(element, key, null);
        }
      }
    }
    if (is_store_default2(object)) {
      for (const key in object) {
        const fn = untrack_default2(() => isFunction2(object[key]) ? object[key] : object[SYMBOL_STORE_OBSERVABLE](key));
        setStyle(element, key, fn);
      }
    } else {
      for (const key in object) {
        setStyle(element, key, object[key]);
      }
    }
  }
};
var setStyles = (element, object) => {
  if (isFunction2(object) || isArray2(object)) {
    let objectPrev;
    use_render_effect_default(() => {
      const objectNext = resolveStyle(object);
      setStylesStatic(element, objectNext, objectPrev);
      objectPrev = objectNext;
    });
  } else {
    setStylesStatic(element, SS_default(object));
  }
};
var setTemplateAccessor = (element, key, value) => {
  if (key === "children") {
    const placeholder = createText("");
    element.insertBefore(placeholder, null);
    value(element, "setChildReplacement", undefined, placeholder);
  } else if (key === "ref") {
    value(element, "setRef");
  } else if (key === "style") {
    value(element, "setStyles");
  } else if (key === "class") {
    if (!isSVG(element)) {
      element.className = "";
    }
    value(element, "setClasses");
  } else if (key === "dangerouslySetInnerHTML") {
    value(element, "setHTML");
  } else if (key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110) {
    value(element, "setEvent", key.toLowerCase());
  } else if (key.charCodeAt(0) === 117 && key.charCodeAt(3) === 58) {
    value(element, "setDirective", key.slice(4));
  } else if (key === "innerHTML" || key === "outerHTML" || key === "textContent" || key === "className") {
  } else if (key in element && !isSVG(element)) {
    value(element, "setProperty", key);
  } else {
    element.setAttribute(key, "");
    value(element, "setAttribute", key);
  }
};
var setProp = (element, key, value) => {
  if (value === undefined)
    return;
  if (isTemplateAccessor(value)) {
    setTemplateAccessor(element, key, value);
  } else if (key === "children") {
    setChild(element, value);
  } else if (key === "ref") {
    setRef(element, value);
  } else if (key === "style") {
    setStyles(element, value);
  } else if (key === "class") {
    setClasses(element, value);
  } else if (key === "dangerouslySetInnerHTML") {
    setHTML(element, value);
  } else if (key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110) {
    setEvent(element, key.toLowerCase(), value);
  } else if (key.charCodeAt(0) === 117 && key.charCodeAt(3) === 58) {
    setDirective(element, key.slice(4), value);
  } else if (key === "innerHTML" || key === "outerHTML" || key === "textContent" || key === "className") {
  } else if (key in element && !isSVG(element)) {
    setProperty(element, key, value);
  } else {
    setAttribute(element, key, value);
  }
};
var setProps = (element, object) => {
  for (const key in object) {
    setProp(element, key, object[key]);
  }
};
var createElement = (component, props, ..._children) => {
  const { children: __children, key, ref, ...rest } = props || {};
  const children = _children.length === 1 ? _children[0] : _children.length === 0 ? __children : _children;
  if (isFunction2(component)) {
    const props2 = rest;
    if (!isNil(children))
      props2.children = children;
    if (!isNil(ref))
      props2.ref = ref;
    return wrap_element_default(() => {
      return untrack_default2(() => component.call(component, props2));
    });
  } else if (isString(component)) {
    const props2 = rest;
    const isSVG2 = isSVGElement(component);
    const createNode = isSVG2 ? createSVGNode : createHTMLNode;
    if (!isVoidChild(children))
      props2.children = children;
    if (!isNil(ref))
      props2.ref = ref;
    return wrap_element_default(() => {
      const child = createNode(component);
      if (isSVG2)
        child["isSVG"] = true;
      untrack_default2(() => setProps(child, props2));
      return child;
    });
  } else if (isNode(component)) {
    return wrap_element_default(() => component);
  } else {
    throw new Error("Invalid component");
  }
};
var create_element_default = createElement;
var SYMBOL_COLD_COMPONENT = Symbol("HMR.Cold");
var SYMBOL_HOT_COMPONENT = Symbol("HMR.Hot");
var SYMBOL_HOT_ID = Symbol("HMR.ID");
var SOURCES = new WeakMap;
var n = function(t, s, r, e) {
  var u;
  s[0] = 0;
  for (var h2 = 1;h2 < s.length; h2++) {
    var p = s[h2++], a = s[h2] ? (s[0] |= p ? 1 : 2, r[s[h2++]]) : s[++h2];
    p === 3 ? e[0] = a : p === 4 ? e[1] = Object.assign(e[1] || {}, a) : p === 5 ? (e[1] = e[1] || {})[s[++h2]] = a : p === 6 ? e[1][s[++h2]] += a + "" : p ? (u = t.apply(a, n(t, a, r, ["", null])), e.push(u), a[0] ? s[0] |= 2 : (s[h2 - 2] = 0, s[h2] = u)) : e.push(a);
  }
  return e;
};
var t = new Map;
function htm_module_default(s) {
  var r = t.get(this);
  return r || (r = new Map, t.set(this, r)), (r = n(this, r.get(s) || (r.set(s, r = function(n2) {
    for (var t2, s2, r2 = 1, e = "", u = "", h2 = [0], p = function(n3) {
      r2 === 1 && (n3 || (e = e.replace(/^\s*\n\s*|\s*\n\s*$/g, ""))) ? h2.push(0, n3, e) : r2 === 3 && (n3 || e) ? (h2.push(3, n3, e), r2 = 2) : r2 === 2 && e === "..." && n3 ? h2.push(4, n3, 0) : r2 === 2 && e && !n3 ? h2.push(5, 0, true, e) : r2 >= 5 && ((e || !n3 && r2 === 5) && (h2.push(r2, 0, e, s2), r2 = 6), n3 && (h2.push(r2, n3, 0, s2), r2 = 6)), e = "";
    }, a = 0;a < n2.length; a++) {
      a && (r2 === 1 && p(), p(a));
      for (var l = 0;l < n2[a].length; l++)
        t2 = n2[a][l], r2 === 1 ? t2 === "<" ? (p(), h2 = [h2], r2 = 3) : e += t2 : r2 === 4 ? e === "--" && t2 === ">" ? (r2 = 1, e = "") : e = t2 + e[0] : u ? t2 === u ? u = "" : e += t2 : t2 === '"' || t2 === "'" ? u = t2 : t2 === ">" ? (p(), r2 = 1) : r2 && (t2 === "=" ? (r2 = 5, s2 = e, e = "") : t2 === "/" && (r2 < 5 || n2[a][l + 1] === ">") ? (p(), r2 === 3 && (h2 = h2[0]), r2 = h2, (h2 = h2[0]).push(2, 0, r2), r2 = 0) : t2 === " " || t2 === "\t" || t2 === `
` || t2 === "\r" ? (p(), r2 = 2) : e += t2), r2 === 3 && e === "!--" && (r2 = 4, h2 = h2[0]);
    }
    return p(), h2;
  }(s)), r), arguments, [])).length > 1 ? r : r[0];
}
var registry = {};
var h2 = (type, props, ...children) => create_element_default(registry[type] || type, props, ...children);
var register = (components) => void assign(registry, components);
var html = assign(htm_module_default.bind(h2), { register });
var useGuarded = (value, guard) => {
  let valueLast;
  const guarded = use_memo_default(() => {
    const current = SS_default(value);
    if (!guard(current))
      return valueLast;
    return valueLast = current;
  });
  return () => {
    const current = guarded();
    if (isNil(current))
      throw new Error("The value never passed the type guard");
    return current;
  };
};
var use_guarded_default = useGuarded;
var If = ({
  when,
  fallback,
  children
}) => {
  if (isFunction2(children) && !is_observable_default2(children) && !isComponent(children)) {
    const truthy = use_guarded_default(when, isTruthy);
    return ternary_default(when, use_untracked_default(() => children(truthy)), fallback);
  } else {
    return ternary_default(when, children, fallback);
  }
};
var if_default2 = If;
var runWithSuperRoot = with_default();
var Switch = ({
  when,
  fallback,
  children
}) => {
  const childrenWithValues = castArray2(children);
  const values = childrenWithValues.map((child) => child().metadata);
  return switch_default(when, values, fallback);
};
Switch.Case = ({
  when,
  children
}) => {
  const metadata = { metadata: [when, children] };
  return assign(() => children, metadata);
};
Switch.Default = ({
  children
}) => {
  const metadata = { metadata: [children] };
  return assign(() => children, metadata);
};
var UiEvents = src_default({ type: "Start" });
src_default.effect(() => {
  console.log("NEX EVENT", UiEvents());
});

// node_modules/@solenopsys/converged-renderer/dist/jsx.js
var jsx = (component, props) => {
  return create_element_default(component, props);
};

// src/banner.tsx
var Banner = (conf) => {
  console.log("BANNER", conf);
  return () => /* @__PURE__ */ jsx("div", {
    class: banner_module_default.banner,
    style: { backgroundImage: `url(https://zero.node.solenopsys.org/ipfs/${conf.image["/"]})` },
    children: /* @__PURE__ */ jsx("div", {
      class: `flex items-end justify-center text-center ${banner_module_default.banner_title}`,
      children: conf.title
    }, undefined, false, undefined, this)
  }, undefined, false, undefined, this);
};
// src/styles/tiles.module.css
var tiles_module_default = "./tiles.module-q6zp5ncx.css";

// src/tiles.tsx
function getImageUrl(image) {
  if (!image)
    return "";
  return `https://zero.node.solenopsys.org/ipfs/${image["/"]}`;
}
var Tile = (props) => {
  return /* @__PURE__ */ jsx("div", {
    class: ` ${tiles_module_default.shadow_transition} border-2 rounded-md min-w-[300px]  m-5  min-h-[100px]`,
    children: [
      /* @__PURE__ */ jsx(if_default2, {
        when: props.image,
        children: /* @__PURE__ */ jsx("img", {
          src: getImageUrl(props.image),
          width: 300,
          class: "rounded-t-md bottom-0"
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsx("div", {
        class: "p-7 ",
        children: [
          /* @__PURE__ */ jsx("img", {
            src: getImageUrl(props.logo)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsx(if_default2, {
            when: !props.logo,
            children: /* @__PURE__ */ jsx("b", {
              children: props.name
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsx("div", {
            children: /* @__PURE__ */ jsx("p", {
              children: props.description
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsx(if_default2, {
            when: props.link,
            children: /* @__PURE__ */ jsx("div", {
              class: "font-size-3",
              children: /* @__PURE__ */ jsx("a", {
                href: props.link,
                children: "Learn more..."
              }, undefined, false, undefined, this)
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
};
var TilesGroup = (props) => {
  return () => {
    return /* @__PURE__ */ jsx("div", {
      children: [
        /* @__PURE__ */ jsx("h2", {
          class: "text-center",
          children: props.title
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsx("div", {
          class: "flex items-center justify-center",
          children: /* @__PURE__ */ jsx("div", {
            class: "flex flex-row flex-wrap  justify-center",
            children: props.tiles.map((fw) => /* @__PURE__ */ jsx(Tile, {
              ...fw
            }, undefined, false, undefined, this))
          }, undefined, false, undefined, this)
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this);
  };
};
export {
  TilesGroup,
  Banner
};
