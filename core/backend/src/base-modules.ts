/**
 * Hands the server's own `back-core` and `nrpc` to modules loaded from the
 * registry.
 *
 * A registry module is bundled without them — see the base externals in
 * `core/tools/registry/src/build.ts` — so at boot it asks for them by name. In
 * the image there is nothing to resolve that name against: the server is a
 * single bundle and carries no `node_modules` for its own packages.
 *
 * Installing them beside it would resolve the name and still be wrong. There
 * would then be two `back-core`s: the one the server is running and the one the
 * modules imported. A module would register its service into a registry the
 * server never reads, open a second transport, and populate a request context
 * nothing consults — all of it silently, because both halves work perfectly on
 * their own.
 *
 * So the specifier is answered with the live namespace instead of a file. One
 * instance by construction, and the module cannot tell the difference.
 */

import * as nrpc from "nrpc";
import * as settings from "./config/settings";
import * as backCore from "./index";
import * as requestContext from "./request-context";
import * as fujinServices from "./server/fujin-services";
import * as serverApp from "./server/server-app";
import * as workspaceDomain from "./workspace-domain";

/**
 * The subpaths a module may import, kept in step with `back-core`'s `exports`.
 * A subpath missing here fails loudly at the module's first import rather than
 * resolving to a second copy, which is the failure worth having.
 */
const BASE_MODULES: Record<string, unknown> = {
	"back-core": backCore,
	"back-core/settings": settings,
	"back-core/request-context": requestContext,
	"back-core/workspace-domain": workspaceDomain,
	"back-core/server-app": serverApp,
	"back-core/fujin-services": fujinServices,
	"back-core/server": backCore,
	nrpc,
};

let registered = false;

export function registerBaseModules(): void {
	if (registered) return;
	registered = true;

	Bun.plugin({
		name: "base-modules",
		setup(build) {
			for (const [specifier, exports] of Object.entries(BASE_MODULES)) {
				build.module(specifier, () => ({
					exports: exports as Record<string, unknown>,
					loader: "object",
				}));
			}
		},
	});
}
