import type { ComponentChildren, ComponentType } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Check } from "../icons";

export type ActionMenuItem = {
	id: string;
	label: string;
	icon?: ComponentType<{ size?: number; class?: string }>;
	danger?: boolean;
	checked?: boolean;
};


export function ActionMenu({
	items,
	onSelect,
	trigger,
	label,
	align = "end",
}: {
	items: ActionMenuItem[];
	onSelect: (id: string) => void;
	trigger: ComponentChildren;
	label: string;
	align?: "start" | "end";
}) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!open) return;

		const onPointerDown = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};

		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	if (items.length === 0) return null;

	return (
		<div class="shell-menu" ref={rootRef}>
			<button
				type="button"
				class="shell-menu-trigger"
				aria-label={label}
				title={label}
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
			>
				{trigger}
			</button>
			{open ? (
				<div class="shell-menu-list" role="menu" data-align={align}>
					{items.map((item) => (
						<button
							key={item.id}
							type="button"
							role="menuitem"
							class="shell-menu-item"
							data-danger={item.danger ? "true" : undefined}
							onClick={() => {
								setOpen(false);
								onSelect(item.id);
							}}
						>
							{item.icon ? <item.icon size={13} class="shell-menu-icon" /> : null}
							<span>{item.label}</span>
							{item.checked ? <Check size={12} class="shell-menu-check" /> : null}
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}
