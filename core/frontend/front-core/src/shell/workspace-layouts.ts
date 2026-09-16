import type { Event, EventCallable, Store } from "effector";
import {
	createEnvironmentServiceClient,
	type ScopedLayout,
	type UserEnvironment,
} from "g-environment/browser";
import { $signalStatus, createFrontNrpcClientConfig } from "signal-channel";
import { authToken } from "../auth-token";
import { homeSections } from "../dashboard/home";
import { $activeLocale, LocaleController } from "../i18n";
import { extractLocaleFromPath } from "../landing/i18n";
import {
	mergeLayouts,
	type PinLayout,
	type ScopedTabSet,
	sameLayout,
	type TabSet,
} from "../tabs";
import { menus, surfaces } from "./workspace";

/**
 * Keeps what a user pinned — in the strip, inside each surface, on the home
 * screen — and the language they chose, across reloads and machines.
 *
 * Every tabbed place holds pins as overrides on top of what its catalog
 * suggests; this module reads them from `rp-environment` once per account and
 * writes one place back whenever its pins change. Guests keep pins for the page
 * only: the service answers a signed-in user, and what a guest pinned is
 * carried into the account they sign in to rather than thrown away.
 */

export type LayoutClient = {
	getCurrent(): Promise<
		Pick<UserEnvironment, "surfaces" | "layouts"> & { locale?: string }
	>;
	saveLayout(scope: string, layout: PinLayout): Promise<unknown>;
	saveLocale(locale: string): Promise<unknown>;
};

/** The interface language as the sync sees it. */
export type LocaleBinding = {
	current: () => string;
	restored: (locale: string) => void;
	changed: Event<string>;
};

/** A tabbed place as the sync sees it: stored scope names and pins. */
export type LayoutBinding = {
	$layouts: Store<Readonly<Record<string, PinLayout>>>;
	restored: (scope: string, layout: PinLayout) => void;
	changed: Event<{ scope: string; layout: PinLayout }>;
	cleared: EventCallable<void>;
	/** The name a local scope is stored under. */
	stored: (scope: string) => string;
	/** The local scope a stored name belongs to, or null if not this binding's. */
	local: (stored: string) => string | null;
};

/** A place with one scope, stored under `name`. */
export function singleBinding(set: TabSet, name: string): LayoutBinding {
	return {
		$layouts: set.$layout.map((layout) => ({ [name]: layout })),
		restored: (_scope, layout) => set.layoutRestored(layout),
		changed: set.pinsChanged.map((layout) => ({ scope: name, layout })),
		cleared: set.cleared,
		stored: () => name,
		local: (stored) => (stored === name ? name : null),
	};
}

/** A place with a scope per key, stored as `prefix` + scope. */
export function scopedBinding(
	set: ScopedTabSet,
	prefix: string,
): LayoutBinding {
	return {
		$layouts: set.$layouts,
		restored: (scope, layout) => set.layoutRestored({ scope, layout }),
		changed: set.pinsChanged,
		cleared: set.cleared,
		stored: (scope) => `${prefix}${scope}`,
		local: (stored) =>
			stored.startsWith(prefix) ? stored.slice(prefix.length) : null,
	};
}

const EMPTY: PinLayout = { pinned: [], unpinned: [] };

const isEmpty = (layout: PinLayout): boolean =>
	layout.pinned.length === 0 && layout.unpinned.length === 0;

export const SURFACES_SCOPE = "surfaces";

function storedLayouts(
	environment: Pick<UserEnvironment, "surfaces" | "layouts">,
): Map<string, PinLayout> {
	const layouts = new Map<string, PinLayout>(
		(environment.layouts ?? []).map(
			({ scope, pinned, unpinned }: ScopedLayout) => [
				scope,
				{ pinned, unpinned },
			],
		),
	);
	layouts.set(SURFACES_SCOPE, environment.surfaces ?? EMPTY);
	return layouts;
}

/**
 * The sync without its wiring, so a test can drive it with a fake service and
 * a fake session. `subject` is the signed-in account, or null for a guest.
 */
export function createLayoutSync(options: {
	client: () => LayoutClient;
	subject: () => string | null;
	bindings: readonly LayoutBinding[];
	locale?: LocaleBinding;
}) {
	/** Account whose pins are on screen; null while nobody is signed in. */
	let owner: string | null = null;
	/** Whether the pins on screen already include what the service remembered. */
	let hydrated = false;
	let loading: Promise<void> | null = null;
	let writes: Promise<void> = Promise.resolve();
	/** A language picked before the account answered — newer than what it holds. */
	let chosenLocale: string | null = null;
	/** What the account holds, so restoring it is not written straight back. */
	let savedLocale: string | null = null;

	function enqueue(write: () => Promise<unknown>, what: string): void {
		const account = owner;
		if (!account || !hydrated) return;
		// Chained so two quick changes land in the order they were made.
		writes = writes.then(async () => {
			if (owner !== account) return;
			try {
				await write();
			} catch (error) {
				console.warn(`[workspace-layouts] ${what} not saved`, error);
			}
		});
	}

	function save(scope: string, layout: PinLayout): void {
		enqueue(() => options.client().saveLayout(scope, layout), "layout");
	}

	function saveLocale(locale: string): void {
		if (!hydrated || locale === savedLocale) return;
		savedLocale = locale;
		enqueue(() => options.client().saveLocale(locale), "locale");
	}

	async function load(account: string): Promise<void> {
		try {
			const environment = await options.client().getCurrent();
			const stored = storedLayouts(environment);
			if (owner !== account) return;
			hydrated = true;
			if (options.locale) {
				const remembered = environment.locale ?? "";
				savedLocale = remembered;
				if (chosenLocale && chosenLocale !== remembered) {
					saveLocale(chosenLocale);
				} else if (remembered && remembered !== options.locale.current()) {
					options.locale.restored(remembered);
				}
				chosenLocale = null;
			}
			for (const binding of options.bindings) {
				const local = binding.$layouts.getState();
				const scopes = new Set<string>();
				for (const name of stored.keys()) {
					const scope = binding.local(name);
					if (scope !== null) scopes.add(scope);
				}
				for (const [scope, layout] of Object.entries(local)) {
					if (!isEmpty(layout)) scopes.add(scope);
				}
				for (const scope of scopes) {
					const name = binding.stored(scope);
					const remembered = stored.get(name) ?? EMPTY;
					const merged = mergeLayouts(remembered, local[scope] ?? EMPTY);
					binding.restored(scope, merged);
					// Anything pinned while the answer was on its way — or by the guest
					// who just signed in — is newer than what the service holds.
					if (!sameLayout(merged, remembered)) save(name, merged);
				}
			}
		} catch (error) {
			// Left unhydrated: toggles stay on the page, and the next reconnect
			// asks again instead of overwriting a layout it never read.
			console.warn("[workspace-layouts] layout unavailable", error);
		}
	}

	function refresh(): Promise<void> {
		const next = options.subject();
		if (next !== owner) {
			// The previous account's pins were somebody else's choice.
			if (owner !== null) {
				for (const binding of options.bindings) binding.cleared();
			}
			owner = next;
			hydrated = false;
			loading = null;
			savedLocale = null;
		}
		if (!owner || hydrated) return Promise.resolve();
		loading ??= load(owner).finally(() => {
			loading = null;
		});
		return loading;
	}

	const subscriptions = options.bindings.map((binding) =>
		binding.changed.watch(({ scope, layout }) =>
			save(binding.stored(scope), layout),
		),
	);
	if (options.locale) {
		subscriptions.push(
			options.locale.changed.watch((locale) => {
				if (hydrated) saveLocale(locale);
				else chosenLocale = locale;
			}),
		);
	}

	return {
		refresh,
		/** Resolves once every write queued so far has been sent. */
		flushed: () => writes,
		stop: () => {
			for (const subscription of subscriptions) subscription.unsubscribe();
		},
	};
}

/**
 * The shell's language. A locale in the path — a landing page — is the page's
 * own, so the account's choice does not override it there.
 */
export const workspaceLocaleBinding = (): LocaleBinding => ({
	current: () => $activeLocale.getState(),
	restored: (locale) => {
		if (extractLocaleFromPath(window.location.pathname)) return;
		LocaleController.getInstance().setLocale(locale);
	},
	changed: $activeLocale.updates,
});

/** Every tabbed place whose pins the user keeps. */
export const workspaceLayoutBindings = (): LayoutBinding[] => [
	singleBinding(surfaces, SURFACES_SCOPE),
	scopedBinding(menus, "menu:"),
	singleBinding(homeSections, "home"),
];

let stopLayouts: (() => void) | undefined;

/** Idempotent, like `startNotifications`: the shell mounts once, bundles may not. */
export function startWorkspaceLayouts(): () => void {
	if (stopLayouts) return stopLayouts;

	let client: LayoutClient | undefined;
	const sync = createLayoutSync({
		client: () => {
			client ??= createEnvironmentServiceClient(createFrontNrpcClientConfig());
			return client;
		},
		subject: () =>
			authToken.isAuthenticated() ? (authToken.payload()?.sub ?? null) : null,
		bindings: workspaceLayoutBindings(),
		locale: workspaceLocaleBinding(),
	});

	// A request before the socket is up would only fail; `watch` fires with the
	// current status too, so an already-open socket loads immediately.
	const status = $signalStatus.watch((value) => {
		if (value === "connected") void sync.refresh();
	});
	const onAuthChange = () => void sync.refresh();
	window.addEventListener("auth-token-changed", onAuthChange);

	stopLayouts = () => {
		status.unsubscribe();
		window.removeEventListener("auth-token-changed", onAuthChange);
		sync.stop();
		stopLayouts = undefined;
	};
	return stopLayouts;
}
