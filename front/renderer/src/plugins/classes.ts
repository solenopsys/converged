export interface ClassPlugin {
	(element: HTMLElement, className: string): void;
}

const plugins = new Set<ClassPlugin>();

export function addClassPlugin(plugin: ClassPlugin) {
	plugins.add(plugin);
}

export function removeClassPlugin(plugin: ClassPlugin) {
	plugins.delete(plugin);
}

export function classListernerCallback(
	element: HTMLElement,
	className: string,
) {
	if (plugins.size === 0) return;
	plugins.forEach((plugin: ClassPlugin) => plugin(element, className));
}
