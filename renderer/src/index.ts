/* IMPORT */

import "./singleton";
import "./jsx/types";
import type {
	Context,
	Directive,
	DirectiveOptions,
	EffectOptions,
	FunctionMaybe,
	MemoOptions,
	Observable,
	ObservableLike,
	ObservableReadonly,
	ObservableReadonlyLike,
	ObservableMaybe,
	ObservableOptions,
	Resource,
	StoreOptions,
} from "./types";

/* EXPORT */

export * from "./components/index";
export * from "./jsx/runtime";
export * from "./hooks/index";
export * from "./methods/index";
export * from "./plugins/index";
export * from "./microfrontends/index";
export * from "./events/index";

export { HTMLElement } from './jsx/types';
export { SVGElement } from './jsx/types';
export { Element } from './types';

export type {
	Context,
	Directive,
	DirectiveOptions,
	EffectOptions,
	FunctionMaybe,
	MemoOptions,
	Observable,
	ObservableLike,
	ObservableReadonly,
	ObservableReadonlyLike,
	ObservableMaybe,
	ObservableOptions,
	Resource,
	StoreOptions,
};
