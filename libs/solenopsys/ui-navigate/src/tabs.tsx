import type { Component } from "@solenopsys/converged-renderer";
import $ from "@solenopsys/converged-reactive";
// @ts-ignore
import styles from "./styles/tabs.module.css";
import { css } from "./css";

const tabStyleClass = css(styles, ".tab_style");
const selectedClass = css(styles, ".selected");

export type Tab = {
	id: string;
	title: string;
};

export type TabsProps = {
	selected: string;
	tabs: Tab[];
	tabClick?: (tabId: string) => void;
};

export type TabsComponent = Component<TabsProps>;

export const UiTabs: TabsComponent = (props: TabsProps) => {

	const selected = $<string | undefined>(props.selected);
	const tabs = $(props.tabs);
	const tabClickHandler = (tabId: string) => {
		selected(tabId);
		if (props.tabClick) {
			props.tabClick(tabId);
		}
	};

	return () => {
		return (
			<div style={{ display: "flex" }} >
				{tabs()?.map((tab: Tab) => (
					<div 		class={styles.shadow_transition}>
					<div
						onClick={() => tabClickHandler(tab.id)}
						class={{
							[tabStyleClass]: true,
							[selectedClass]: selected()?.startsWith(tab.id) ,
						}}

				
					>
						{tab.title}
					</div>
					</div>
				))}
			</div>
		);
	};
};
