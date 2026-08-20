import type { ComponentChildren } from "preact";
import { MoreHorizontal, Pin, X } from "../icons";
import { ActionMenu, type ActionMenuItem } from "./ActionMenu";

export type TopBarLink = {
	label: string;
	href: string;
	current?: boolean;
};

export type TopBarTab = {
	key: string;
	title: string;
	pinned: boolean;
	active: boolean;
	actions: ActionMenuItem[];
};


export function TopBar({
	brand,
	brandHref,
	onBrandClick,
	tabs = [],
	links = [],
	onTabSelect,
	onTabClose,
	onTabAction,
	controls,
	navigationLabel = "Main navigation",
	tabsLabel = "Workspace tabs",
}: {
	brand: ComponentChildren;
	brandHref?: string;
	onBrandClick?: () => void;
	tabs?: TopBarTab[];
	links?: TopBarLink[];
	onTabSelect?: (key: string) => void;
	onTabClose?: (key: string) => void;
	onTabAction?: (key: string, actionId: string) => void;
	controls?: ComponentChildren;
	navigationLabel?: string;
	tabsLabel?: string;
}) {
	const activeKey = tabs.find((tab) => tab.active)?.key ?? "";

	return (
		<header class="top-bar">
			{onBrandClick ? (
				<button type="button" class="top-bar-brand" onClick={onBrandClick}>
					{brand}
				</button>
			) : (
				<a class="top-bar-brand" href={brandHref}>
					{brand}
				</a>
			)}

			{tabs.length > 0 ? (
				<>
					<nav class="top-bar-tabs" aria-label={tabsLabel} role="tablist">
						{tabs.map((tab) => (
							<div
								key={tab.key}
								class="top-bar-tab"
								data-active={tab.active ? "true" : undefined}
								data-pinned={tab.pinned ? "true" : undefined}
								role="presentation"
							>
								<button
									type="button"
									class="top-bar-tab-select"
									role="tab"
									aria-selected={tab.active}
									onClick={() => onTabSelect?.(tab.key)}
								>
									{tab.pinned ? (
										<Pin size={11} class="top-bar-tab-pin" aria-hidden="true" />
									) : null}
									<span>{tab.title}</span>
								</button>
								<ActionMenu
									items={tab.actions}
									label={`Действия вкладки ${tab.title}`}
									onSelect={(actionId) => onTabAction?.(tab.key, actionId)}
									trigger={<MoreHorizontal size={13} aria-hidden="true" />}
								/>
								<button
									type="button"
									class="top-bar-tab-close"
									aria-label={`Закрыть ${tab.title}`}
									title="Закрыть вкладку"
									onClick={() => onTabClose?.(tab.key)}
								>
									<X size={11} aria-hidden="true" />
								</button>
							</div>
						))}
					</nav>
					<select
						class="top-bar-tab-combobox"
						aria-label={tabsLabel}
						value={activeKey}
						onChange={(event) => onTabSelect?.(event.currentTarget.value)}
					>
						{tabs.map((tab) => (
							<option key={tab.key} value={tab.key}>
								{tab.pinned ? "📌 " : ""}
								{tab.title}
							</option>
						))}
					</select>
				</>
			) : (
				<nav class="top-bar-nav" aria-label={navigationLabel}>
					{links.map((link) => (
						<a
							key={link.href}
							href={link.href}
							aria-current={link.current ? "page" : undefined}
						>
							{link.label}
						</a>
					))}
				</nav>
			)}

			<div class="top-bar-controls">{controls}</div>
		</header>
	);
}
