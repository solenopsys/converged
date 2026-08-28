import type { ComponentChildren, ComponentType, JSX } from "preact";
import { Check } from "../icons";
import { usePopover } from "./popover";

export type ActionMenuItem = {
	id: string;
	label: string;
	icon?: ComponentType<{ size?: number; class?: string }>;
	danger?: boolean;
	checked?: boolean;
};


/**
 * The list on its own, so callers that own their trigger (tab context menu,
 * overflow menu) reuse the same chrome without re-implementing it.
 */
export function ActionMenuList({
	items,
	onSelect,
	align = "end",
	style,
}: {
	items: ActionMenuItem[];
	onSelect: (id: string) => void;
	align?: "start" | "end";
	style?: JSX.CSSProperties;
}) {
	return (
		<div class="shell-menu-list" role="menu" data-align={align} style={style}>
			{items.map((item) => (
				<button
					key={item.id}
					type="button"
					role="menuitem"
					class="shell-menu-item"
					data-danger={item.danger ? "true" : undefined}
					onClick={() => onSelect(item.id)}
				>
					{item.icon ? <item.icon size={13} class="shell-menu-icon" /> : null}
					<span>{item.label}</span>
					{item.checked ? <Check size={12} class="shell-menu-check" /> : null}
				</button>
			))}
		</div>
	);
}


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
	const { ref, open, setOpen } = usePopover<HTMLDivElement>();

	if (items.length === 0) return null;

	return (
		<div class="shell-menu" ref={ref}>
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
				<ActionMenuList
					items={items}
					align={align}
					onSelect={(id) => {
						setOpen(false);
						onSelect(id);
					}}
				/>
			) : null}
		</div>
	);
}
