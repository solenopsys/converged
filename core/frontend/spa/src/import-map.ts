export type ImportMap = { imports: Record<string, string> };

const baseImports: Record<string, string> = {
	preact: "/vendor/preact.js",
	"preact/hooks": "/vendor/preact.js",
	"preact/jsx-runtime": "/vendor/preact.js",
	"preact/jsx-dev-runtime": "/vendor/preact.js",
	"preact/compat": "/vendor/preact-compat.js",
	"preact/compat/client": "/vendor/preact-compat-client.js",
	// Some browser packages are compiled against React names while running on
	// Preact. Keep those imports in the same compat instance as the shell.
	react: "/vendor/preact-compat.js",
	"react-dom": "/vendor/preact-compat.js",
	"react-dom/client": "/vendor/preact-compat-client.js",
	"react/jsx-runtime": "/vendor/preact.js",
	"react/jsx-dev-runtime": "/vendor/preact.js",
	effector: "/vendor/effector.js",
	"effector/effector.mjs": "/vendor/effector.js",
	"effector/inspect": "/vendor/effector-inspect.js",
	"effector-preact": "/vendor/effector.js",
	"front-core/core": "/vendor/front-core-core.js",
	"front-core/object-runtime": "/vendor/front-core-object-runtime.js",
	"front-core": "/vendor/front-core.js",
	"front-core/chat/config-page": "/vendor/front-core.js",
	"front-core/shell": "/vendor/front-core.js",
	"front-core/landing": "/vendor/front-core.js",
	"front-core/table": "/vendor/front-core-table.js",
	"front-core/model3d": "/vendor/front-core.js",
	audit: "/assets/audit.js",
	"signal-channel": "/vendor/signal-channel.js",
	nrpc: "/vendor/nrpc.js",
	"@zag-js/preact": "/vendor/zag.js",
	"@zag-js/select": "/vendor/zag.js",
	"@zag-js/tooltip": "/vendor/zag.js",
	d3: "/vendor/d3.js",
};

export function createImportMap(microfrontends: readonly string[]): ImportMap {
	return {
		imports: {
			...baseImports,
			...Object.fromEntries(
				microfrontends.map((name) => [`mf-${name}`, `/mf/${name}.js`]),
			),
		},
	};
}
