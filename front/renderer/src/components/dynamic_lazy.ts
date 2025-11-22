/* IMPORT */

import useMemo from "../hooks/use_memo";
import createElement from "../methods/create_element";
import resolve from "../methods/resolve";
import $$ from "../methods/SS";
import $ from "../methods/S";
import { resolveComponent } from "../microfrontends/cache";

import type { Child, FunctionMaybe, ComponentLink } from "../types";
import { untrack } from "@solenopsys/converged-reactive";

const DynamicLazy = <P = {}>({
	component,
	props,
	children,
}: {
	component: ComponentLink;
	props?: FunctionMaybe<P | null>;
	children?: Child;
}): Child => {
	console.log("DynamicLazy", component);
	//const cm = $(component)
	return untrack(() => {
		const comp = resolveComponent<P>(component);
		const element = createElement<P>(comp, $$(props), children);
		return resolve(element);
	});
};

/* EXPORT */

export default DynamicLazy;
