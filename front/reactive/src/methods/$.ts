/* IMPORT */

import batch from "./batch";
import boolean from "./boolean";
import cleanup from "./cleanup";
import context from "./context";
import disposed from "./disposed";
import effect from "./effect";
import _for from "./for";
import get from "./get";
import _if from "./if";
import isBatching from "./is_batching";
import isObservable from "./is_observable";
import isStore from "./is_store";
import memo from "./memo";
import observable from "./observable";
import owner from "./owner";
import readonly from "./readonly";
import resolve from "./resolve";
import root from "./root";
import selector from "./selector";
import store from "./store";
import suspended from "./suspended";
import suspense from "./suspense";
import _switch from "./switch";
import ternary from "./ternary";
import tick from "./tick";
import tryCatch from "./try_catch";
import untrack from "./untrack";
import untracked from "./untracked";
import _with from "./with";
import { writable } from "../objects/callable";
import ObservableClass from "../objects/observable";
import type { ObservableOptions, Observable } from "../types";

/* MAIN */

function $<T>(): Observable<T | undefined>;
function $<T>(
	value: undefined,
	options?: ObservableOptions<T | undefined>,
): Observable<T | undefined>;
function $<T>(value: T, options?: ObservableOptions<T>): Observable<T>;
function $<T>(value?: T, options?: ObservableOptions<T | undefined>) {
	return writable(new ObservableClass(value, options));
}

/* UTILITIES */

$.batch = batch;
$.boolean = boolean;
$.cleanup = cleanup;
$.context = context;
$.disposed = disposed;
$.effect = effect;
$.for = _for;
$.get = get;
$.if = _if;
$.isBatching = isBatching;
$.isObservable = isObservable;
$.isStore = isStore;
$.memo = memo;
$.observable = observable;
$.owner = owner;
$.readonly = readonly;
$.resolve = resolve;
$.root = root;
$.selector = selector;
$.store = store;
$.suspended = suspended;
$.suspense = suspense;
$.switch = _switch;
$.ternary = ternary;
$.tick = tick;
$.tryCatch = tryCatch;
$.untrack = untrack;
$.untracked = untracked;
$.with = _with;

/* EXPORT */

export default $;
