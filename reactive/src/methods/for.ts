/* IMPORT */

import cleanup from "./cleanup";
import CacheKeyed from "./for.cache.keyed";
import CacheUnkeyed from "./for.cache.unkeyed";
import get from "./get";
import isObservable from "./is_observable";
import isStore from "./is_store";
import memo from "./memo";
import resolve from "./resolve";
import untrack from "./untrack";
import { frozen } from "../objects/callable";
import { SYMBOL_CACHED, SYMBOL_STORE_VALUES } from "../symbols";
import { isArray, isEqual } from "../utils";
import type {
	MapFunction,
	MapValueFunction,
	ObservableReadonly,
	FunctionMaybe,
	Resolved,
} from "../types";

/* MAIN */

function _for<T, R, F>(
	values: FunctionMaybe<readonly T[]> | undefined,
	fn: MapFunction<T, R>,
	fallback?: F | [],
	options?: { pooled?: false; unkeyed?: false },
): ObservableReadonly<Resolved<R>[] | Resolved<F>>;
function _for<T, R, F>(
	values: FunctionMaybe<readonly T[]> | undefined,
	fn: MapValueFunction<T, R>,
	fallback?: F | [],
	options?: { pooled?: boolean; unkeyed?: true },
): ObservableReadonly<Resolved<R>[] | Resolved<F>>;
function _for<T, R, F>(
	values: FunctionMaybe<readonly T[]> | undefined,
	fn: MapFunction<T, R> | MapValueFunction<T, R>,
	fallback: F | [] = [],
	options?: { pooled?: boolean; unkeyed?: boolean },
): ObservableReadonly<Resolved<R>[] | Resolved<F>> {
	if (isArray(values) && !isStore(values)) {
		// Fast path for plain arrays

		const isUnkeyed = !!options?.unkeyed;

		return frozen(
			untrack(() => {
				if (values.length) {
					return values.map((value, index) => {
						return resolve(
							fn(
								isUnkeyed && !isObservable(value) ? frozen(value) : value,
								index,
							),
						);
					});
				} else {
					return resolve(fallback);
				}
			}),
		);
	} else {
		// Regular path

		const { dispose, map } = options?.unkeyed
			? new CacheUnkeyed(fn as MapValueFunction<T, R>, !!options.pooled)
			: new CacheKeyed(fn as MapFunction<T, R>); //TSC

		cleanup(dispose);

		const value = memo(
			() => {
				return get(values) ?? [];
			},
			{
				equals: (next, prev) => {
					return (
						!!next &&
						!!prev &&
						!next.length &&
						!prev.length &&
						!isStore(next) &&
						!isStore(prev)
					);
				},
			},
		);

		return memo(
			() => {
				const array = value();

				if (isStore(array)) {
					array[SYMBOL_STORE_VALUES];
				}

				return untrack(() => {
					const results = map(array);

					return results?.length ? results : resolve(fallback);
				});
			},
			{
				equals: (next, prev) => {
					return (
						isArray(next) &&
						!!next[SYMBOL_CACHED] &&
						isArray(prev) &&
						isEqual(next, prev)
					);
				},
			},
		);
	}
}

/* EXPORT */

export default _for;
