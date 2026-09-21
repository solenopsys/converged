import { createDomain } from "effector";
import {
	createDomainLogger,
	moduleForAction,
	setActionLoader,
} from "front-core/core";
import {
	objectRegistry,
	registerSurface,
	type SurfaceDefinition,
	setSurfaceLoader,
} from "front-core/object-runtime";
import { $activeSurface } from "./workspace";

const loads = new Map<string, Promise<void>>();
let stylesMounted = false;
const domain = createDomain("surface-loader");
createDomainLogger(domain);

export const surfaceLoadRequested = domain.createEvent<{
	moduleName: string;
	specifier: string;
}>("SURFACE_LOAD_REQUESTED");
export const surfaceLoaded = domain.createEvent<{ moduleName: string }>(
	"SURFACE_LOADED",
);
export const surfaceLoadFailed = domain.createEvent<{
	moduleName: string;
	error: unknown;
}>("SURFACE_LOAD_FAILED");

type SurfaceModule = {
	default?: SurfaceDefinition;
};

function resolveSpecifier(moduleName: string): string {
	const script = document.querySelector<HTMLScriptElement>(
		'script[type="importmap"]',
	);
	if (!script?.textContent) return `/sf/${moduleName}.js`;
	const parsed = JSON.parse(script.textContent) as {
		imports?: Record<string, string>;
	};
	return parsed.imports?.[moduleName] ?? `/sf/${moduleName}.js`;
}

function mountSurfaceStyles(): void {
	if (stylesMounted) return;
	stylesMounted = true;
	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = "/assets/sf.css";
	document.head.append(link);
}

export function loadSurface(moduleName: string): Promise<void> {
	let load = loads.get(moduleName);
	if (!load) {
		mountSurfaceStyles();
		const specifier = resolveSpecifier(moduleName);
		surfaceLoadRequested({ moduleName, specifier });
		load = import(specifier)
			.then((module: SurfaceModule) => {
				if (!module.default?.id) {
					throw new Error(
						`[shell] ${moduleName} loaded from ${specifier} without a surface definition`,
					);
				}
				registerSurface(module.default);
				surfaceLoaded({ moduleName });
			})
			.catch((error) => {
				surfaceLoadFailed({ moduleName, error });
				console.error(`[shell] Failed to load surface "${moduleName}"`, error);
				loads.delete(moduleName);
				throw error;
			});
		loads.set(moduleName, load);
	}
	return load;
}

export function loadSurfaceForType(typeId: string): Promise<void> {
	const moduleName = objectRegistry.ownerForType(typeId);
	if (!moduleName) throw new Error(`[shell] Unknown object type: ${typeId}`);
	return loadSurface(moduleName);
}

export function loadSurfaceForOperation(operationId: string): Promise<void> {
	const moduleName = objectRegistry.ownerForOperation(operationId);
	if (!moduleName) throw new Error(`[shell] Unknown operation: ${operationId}`);
	return loadSurface(moduleName);
}

setSurfaceLoader(loadSurface);
setActionLoader(async (actionId) => {
	const moduleName = moduleForAction(actionId);
	if (!moduleName) throw new Error(`[shell] Unknown action "${actionId}"`);
	await loadSurface(moduleName);
});

// A surface becomes active from the strip, the catalog menu, a pin restored from
// the account or an assistant command. Every path loads the owner, so its
// projections have components by the time one of them is opened.
$activeSurface.updates.watch((surface) => {
	if (!surface || typeof document === "undefined") return;
	if (objectRegistry.surface(surface)?.loaded) return;
	void loadSurface(surface).catch(() => undefined);
});
