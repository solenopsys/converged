import {
	loadObjectType,
	objectRef,
	objectResolver,
} from "front-core/object-runtime";
import type { ComponentChildren, ComponentType } from "preact";
import { useEffect, useState } from "preact/hooks";
import { WorkspaceTopBar } from "./WorkspaceTopBar";
import { workspaceReset } from "./workspace";

const dashboardReference = objectRef("dashboard.dashboard", "statistics", {
	title: "Dashboard",
});

/** The console's persistent home screen, shown outside the transient tab workspace. */
export function ConsoleRoot({ brand }: { brand: ComponentChildren }) {
	const [View, setView] = useState<ComponentType<
		Record<string, unknown>
	> | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void loadObjectType(dashboardReference.type)
			.then(() => {
				const view = objectResolver.resolveView(dashboardReference);
				if (cancelled) return;
				if (view?.component) setView(() => view.component);
				else setFailed(true);
			})
			.catch((error) => {
				console.error("[shell] Failed to load console dashboard", error);
				if (!cancelled) setFailed(true);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<section class="surface">
			<WorkspaceTopBar brand={brand} onBrandClick={workspaceReset} />
			<div class="surface-content">
				{View ? <View /> : null}
				{failed ? (
					<p class="panel-empty-state">Unable to load dashboard.</p>
				) : null}
			</div>
		</section>
	);
}
