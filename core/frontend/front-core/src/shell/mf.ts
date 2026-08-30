import { createDomain } from "effector";
import { createDomainLogger } from "front-core/core";
import {
	type MicrofrontendDefinition,
	objectRegistry,
	registerMicrofrontend,
	setMicrofrontendLoader,
} from "front-core/object-runtime";

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
	default?: MicrofrontendDefinition;
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
				if (!module.default?.id) {
					throw new Error(
						`[shell] ${moduleName} loaded from ${specifier} without a microfrontend definition`,
					);
				}
				registerMicrofrontend(module.default);
				microfrontendLoaded({ moduleName });
			})
			.catch((error) => {
				microfrontendLoadFailed({ moduleName, error });
				console.error(
					`[shell] Failed to load microfrontend "${moduleName}"`,
					error,
				);
				loads.delete(moduleName);
				throw error;
			});
		loads.set(moduleName, load);
	}
	return load;
}

export function loadMicrofrontendForType(typeId: string): Promise<void> {
	const moduleName = objectRegistry.ownerForType(typeId);
	if (!moduleName) throw new Error(`[shell] Unknown object type: ${typeId}`);
	return loadMicrofrontend(moduleName);
}

export function loadMicrofrontendForOperation(
	operationId: string,
): Promise<void> {
	const moduleName = objectRegistry.ownerForOperation(operationId);
	if (!moduleName) throw new Error(`[shell] Unknown operation: ${operationId}`);
	return loadMicrofrontend(moduleName);
}

setMicrofrontendLoader(loadMicrofrontend);
