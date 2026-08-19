import {
	createDomainLogger,
	type ActionRegistry,
	bus,
	moduleForAction,
	type ScreenDecl,
	setActionLoader,
} from "front-core/core";
import { createDomain } from "effector";
import { registerScreens } from "./screens";



const loads = new Map<string, Promise<void>>();
let stylesMounted = false;
const domain = createDomain("microfrontend-loader");
createDomainLogger(domain);

export const microfrontendLoadRequested = domain.createEvent<{
	moduleName: string;
	specifier: string;
}>("MICROFRONTEND_LOAD_REQUESTED");
export const microfrontendLoaded = domain.createEvent<{ moduleName: string }>(
	"MICROFRONTEND_LOADED",
);
export const microfrontendLoadFailed = domain.createEvent<{
	moduleName: string;
	error: unknown;
}>("MICROFRONTEND_LOAD_FAILED");

type MicrofrontendModule = {
	default?: { plug?: (bus: ActionRegistry) => void };
	SCREENS?: ScreenDecl<any>[];
};


function resolveSpecifier(moduleName: string): string {
	const script = document.querySelector<HTMLScriptElement>(
		'script[type="importmap"]',
	);
	if (!script?.textContent) return `/mf/${moduleName}.js`;
	const parsed = JSON.parse(script.textContent) as {
		imports?: Record<string, string>;
	};
	return parsed.imports?.[moduleName] ?? `/mf/${moduleName}.js`;
}


function mountMicrofrontendStyles(): void {
	if (stylesMounted) return;
	stylesMounted = true;
	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = "/assets/mf.css";
	document.head.append(link);
}

export function loadMicrofrontend(moduleName: string): Promise<void> {
	let load = loads.get(moduleName);
	if (!load) {
		mountMicrofrontendStyles();
		const specifier = resolveSpecifier(moduleName);
		microfrontendLoadRequested({ moduleName, specifier });
		load = import(specifier)
			.then((module: MicrofrontendModule) => {
				if (!module.default?.plug) {
					throw new Error(
						`[shell] ${moduleName} loaded from ${specifier} without a default plugin export`,
					);
				}
				module.default.plug(bus);
				if (module.SCREENS) registerScreens(module.SCREENS);
				microfrontendLoaded({ moduleName });
			})
			.catch((error) => {
				microfrontendLoadFailed({ moduleName, error });
				console.error(`[shell] Failed to load microfrontend "${moduleName}"`, error);
				loads.delete(moduleName);
				throw error;
			});
		loads.set(moduleName, load);
	}
	return load;
}


export function loadMicrofrontendForAction(actionId: string): Promise<void> {
	const moduleName = moduleForAction(actionId);
	if (!moduleName) throw new Error(`[shell] Invalid action id: ${actionId}`);
	return loadMicrofrontend(moduleName);
}

setActionLoader(loadMicrofrontendForAction);
