// super-simple effector domain logger
const isDomainLoggerEnabled = (): boolean => {
	if (typeof globalThis === "undefined") return false;

	const scope = globalThis as typeof globalThis & {
		__EFFECTOR_DEBUG__?: boolean;
		localStorage?: Storage;
	};

	if (scope.__EFFECTOR_DEBUG__) return true;

	try {
		return scope.localStorage?.getItem("effector:debug") === "1";
	} catch {
		return false;
	}
};

export function createDomainLogger(
	domain: {
		compositeName: { fullName: string };
		onCreateEvent: (
			h: (ev: {
				compositeName: { fullName: string };
				watch: (fn: (p: any) => void) => () => void;
			}) => void,
		) => void;
		onCreateEffect: (
			h: (fx: {
				compositeName: { fullName: string };
				watch: (fn: (p: any) => void) => () => void;
				done: { watch: (fn: (d: { result: any }) => void) => () => void };
				fail: { watch: (fn: (d: { error: any }) => void) => () => void };
				finally: { watch: (fn: (d: any) => void) => () => void };
			}) => void,
		) => void;
		onCreateDomain: (h: (d: any) => void) => void;
	},
	tag?: string,
): () => void {
	if (!isDomainLoggerEnabled()) {
		return () => {};
	}

	const label = tag ?? domain.compositeName.fullName;
	const subs = new Set<() => void>();
	const log = (type: string, name: string, data: any) =>
		console.log(`[${label}] ${type} ${name}:`, data);

	domain.onCreateEvent((ev) => {
		const name = ev.compositeName.fullName;
		subs.add(ev.watch((payload) => log("event", name, payload)));
	});

	domain.onCreateEffect((fx) => {
		const name = fx.compositeName.fullName;
		subs.add(fx.watch((params) => log("fx:start", name, params)));
		subs.add(fx.done.watch(({ result }) => log("fx:done", name, result)));
		subs.add(fx.fail.watch(({ error }) => log("fx:fail", name, error)));
		subs.add(fx.finally.watch((d) => log("fx:finally", name, d)));
	});

	domain.onCreateDomain((child) => {
		const off = createDomainLogger(child, label);
		subs.add(off);
	});

	return () => {
		for (const off of subs) {
			try {
				off();
			} catch {}
		}
		subs.clear();
	};
}
