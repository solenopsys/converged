import { useUnit } from "effector-preact";
import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { WorkspaceTopBar } from "./WorkspaceTopBar";
import { $activeWorkspaceTab, activeWorkspaceTabClosed } from "./workspace";

export function Surface({
	brand,
	brandHref,
	onBrandClick,
}: {
	brand: ComponentChildren;
	brandHref?: string;
	onBrandClick?: () => void;
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
			<WorkspaceTopBar
				brand={brand}
				brandHref={brandHref}
				onBrandClick={onBrandClick}
			/>
			<div class="surface-content">
				<View {...current.props} />
			</div>
		</section>
	);
}
