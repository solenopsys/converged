import type { ComponentChild, ContainerNode } from "preact";
import {
	hydrate,
	render,
	unmountComponentAtNode,
} from "preact/compat";

export type Root = {
	render(children: ComponentChild): void;
	unmount(): void;
};

// Mirrors Preact's `preact/compat/client` entry while sharing the shell's
// compat instance. This facade also serves packages compiled for react-dom.
export function createRoot(container: ContainerNode): Root {
	return {
		render: (children) => render(children, container),
		unmount: () => unmountComponentAtNode(container),
	};
}

export function hydrateRoot(
	container: ContainerNode,
	children: ComponentChild,
): Root {
	hydrate(children, container);
	return createRoot(container);
}

export default { createRoot, hydrateRoot };
