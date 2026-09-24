import { useUnit } from "effector-preact";
import type { ComponentChildren, JSX } from "preact";
import { useRef } from "preact/hooks";
import { Check } from "../icons";
import { useDismiss } from "./dismiss";
import type { ChoiceMenu } from "./menus";
import type { ActionItem } from "./tab-bar";

/** The rows of a choice menu, for callers that own the trigger and position. */
export function ChoiceList({
	items,
	onChoose,
	align = "end",
	style,
}: {
	items: readonly ActionItem[];
	onChoose: (id: string) => void;
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
					onClick={() => onChoose(item.id)}
				>
					{item.icon ? <item.icon size={13} class="shell-menu-icon" /> : null}
					<span>{item.label}</span>
					{item.checked ? <Check size={12} class="shell-menu-check" /> : null}
				</button>
			))}
		</div>
	);
}

/** A trigger and its list, driven by a `createChoiceMenu` model. */
export function ChoiceMenuButton({
	model,
	items,
	trigger,
	label,
	align = "start",
}: {
	model: ChoiceMenu;
	items: readonly ActionItem[];
	trigger: ComponentChildren;
	label: string;
	align?: "start" | "end";
}) {
	const { open, toggled, closed, chosen } = useUnit({
		open: model.$open,
		toggled: model.toggled,
		closed: model.closed,
		chosen: model.chosen,
	});
	const ref = useRef<HTMLDivElement>(null);
	useDismiss(ref, open, closed);

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
				onClick={() => toggled()}
			>
				{trigger}
			</button>
			{open ? (
				<ChoiceList items={items} align={align} onChoose={chosen} />
			) : null}
		</div>
	);
}
