import type { ComponentLink, Observable } from "../types";
import $ from "../methods/S";
import { usePromise } from "../hooks";
import { lazy } from "../methods";

const MODULES_CACHE: { [key: string]: any } = {};
export const MICROFRONTENDS_CACHE: { [key: string]: any } = {};

async function loadMicrofronend(importModule: any): Promise<any> {
	console.log("LOAD MICROFRONTEND", importModule);
	const componentsMap = await importModule.createMicrofronend();
	Object.keys(componentsMap).forEach((key) => {
		MICROFRONTENDS_CACHE[key] = componentsMap[key];
	});
}

export async function importModule(importPath: string): Promise<any> {
	console.log("START IMPORT MODULE", importPath);
	return await import(importPath);
}

export async function loadModule(
	importPath: string,
	createMf = false,
): Promise<any> {
	if (MODULES_CACHE[importPath]) {
		return MODULES_CACHE[importPath];
	} else {
		const mod = await importModule(importPath);

		if (createMf) loadMicrofronend(mod);
		return mod;
	}
}

export async function load(importPath: string): Promise<any> {
	return loadModule(importPath, true);
}

export function resolveComponent<P>(componentName: ComponentLink): any {
	console.log("RESOLVE COMPONENT", componentName);
	const [modulePaht, componentNameString] = componentName.split(":");
	const resolve = () => {
		return loadModule(modulePaht, false).then((mod) => {
			return mod[componentNameString];
		});
	};

	return lazy(resolve);
}

async function loadComponent(
	importPath: string,
	componentName: string,
): Promise<any> {
	const module = await importModule(importPath);
	if (module) {
		return module[componentName];
	}
}
