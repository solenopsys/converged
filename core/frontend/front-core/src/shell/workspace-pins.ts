import {
	createEnvironmentServiceClient,
	type SurfaceLayout,
	type UserEnvironment,
} from "g-environment/browser";
import { $signalStatus, createFrontNrpcClientConfig } from "signal-channel";
import { authToken } from "../auth-token";
import {
	$surfacePins,
	surfacePinsRestored,
	surfacePinToggled,
} from "./workspace";

/**
 * Keeps the surfaces a user pinned across reloads and machines.
 *
 * The workspace holds pins as overrides on top of the configured ones; this
 * module is the host that `object-runtime/surfaces.ts` describes — it reads
 * them from `rp-environment` once per account and writes the whole layout back
 * on every toggle. Guests keep pins for the page only: the service answers a
 * signed-in user, and what a guest pinned is carried into the account they
 * sign in to rather than thrown away.
 */

export type PinClient = {
	getCurrent(): Promise<Pick<UserEnvironment, "surfaces">>;
	saveSurfaceLayout(layout: SurfaceLayout): Promise<unknown>;
};

export const layoutFromPins = (
	pins: Record<string, boolean>,
): SurfaceLayout => {
	const ids = Object.keys(pins).sort();
	return {
		pinned: ids.filter((id) => pins[id]),
		unpinned: ids.filter((id) => !pins[id]),
	};
};

export const pinsFromLayout = (
	layout: SurfaceLayout | undefined,
): Record<string, boolean> => ({
	...Object.fromEntries((layout?.unpinned ?? []).map((id) => [id, false])),
	...Object.fromEntries((layout?.pinned ?? []).map((id) => [id, true])),
});

/**
 * The sync without its wiring, so a test can drive it with a fake service and
 * a fake session. `subject` is the signed-in account, or null for a guest.
 */
export function createPinSync(options: {
	client: () => PinClient;
	subject: () => string | null;
}) {
	/** Account whose pins are on screen; null while nobody is signed in. */
	let owner: string | null = null;
	/** Whether the pins on screen already include what the service remembered. */
	let hydrated = false;
	let loading: Promise<void> | null = null;
	let writes: Promise<void> = Promise.resolve();

	function save(): void {
		const account = owner;
		if (!account || !hydrated) return;
		const layout = layoutFromPins($surfacePins.getState());
		// Chained so two quick toggles land in the order they were made.
		writes = writes.then(async () => {
			if (owner !== account) return;
			try {
				await options.client().saveSurfaceLayout(layout);
			} catch (error) {
				console.warn("[workspace-pins] layout not saved", error);
			}
		});
	}

	async function load(account: string): Promise<void> {
		try {
			const environment = await options.client().getCurrent();
			if (owner !== account) return;
			const stored = pinsFromLayout(environment.surfaces);
			const local = $surfacePins.getState();
			// Anything toggled while the answer was on its way — or by the guest
			// who just signed in — is newer than what the service holds.
			const changed = Object.entries(local).some(
				([id, pinned]) => stored[id] !== pinned,
			);
			hydrated = true;
			surfacePinsRestored({ ...stored, ...local });
			if (changed) save();
		} catch (error) {
			// Left unhydrated: toggles stay on the page, and the next reconnect
			// asks again instead of overwriting a layout it never read.
			console.warn("[workspace-pins] layout unavailable", error);
		}
	}

	function refresh(): Promise<void> {
		const next = options.subject();
		if (next !== owner) {
			// The previous account's pins were somebody else's choice.
			if (owner !== null) surfacePinsRestored({});
			owner = next;
			hydrated = false;
			loading = null;
		}
		if (!owner || hydrated) return Promise.resolve();
		loading ??= load(owner).finally(() => {
			loading = null;
		});
		return loading;
	}

	const stopToggle = surfacePinToggled.watch(() => save());

	return {
		refresh,
		/** Resolves once every write queued so far has been sent. */
		flushed: () => writes,
		stop: () => stopToggle.unsubscribe(),
	};
}

let stopPins: (() => void) | undefined;

/** Idempotent, like `startNotifications`: the shell mounts once, bundles may not. */
export function startWorkspacePins(): () => void {
	if (stopPins) return stopPins;

	let client: PinClient | undefined;
	const sync = createPinSync({
		client: () => {
			client ??= createEnvironmentServiceClient(createFrontNrpcClientConfig());
			return client;
		},
		subject: () =>
			authToken.isAuthenticated() ? (authToken.payload()?.sub ?? null) : null,
	});

	// A request before the socket is up would only fail; `watch` fires with the
	// current status too, so an already-open socket loads immediately.
	const status = $signalStatus.watch((value) => {
		if (value === "connected") void sync.refresh();
	});
	const onAuthChange = () => void sync.refresh();
	window.addEventListener("auth-token-changed", onAuthChange);

	stopPins = () => {
		status.unsubscribe();
		window.removeEventListener("auth-token-changed", onAuthChange);
		sync.stop();
		stopPins = undefined;
	};
	return stopPins;
}
