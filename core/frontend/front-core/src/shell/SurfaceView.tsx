import { useUnit } from "effector-preact";
import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { $activeWorkspaceTab, activeWorkspaceTabClosed } from "./workspace";
import { WorkspaceTopBar } from "./WorkspaceTopBar";

export function Surface({
	brand,
	brandHref,
}: {
	brand: ComponentChildren;
	brandHref?: string;
}) {
	const current = useUnit($activeWorkspaceTab);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") activeWorkspaceTabClosed();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	if (!current) return null;

	const View = current.view;

	return (
		<section class="surface">
			<WorkspaceTopBar brand={brand} brandHref={brandHref} />
			<div class="surface-content">
				<View {...current.props} />
			</div>
		</section>
	);
}
