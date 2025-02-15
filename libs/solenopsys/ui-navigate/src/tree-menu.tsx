import $ from "@solenopsys/converged-reactive";
import { If, type Component,createContext } from "@solenopsys/converged-renderer";
// @ts-ignore
import styles from "./styles/tree-menu.module.css";

type Click = {
	onClickLink: (link: string) => void;
};

export type MenuItemData = {
	name: string;
	link: string;
	icon?: string;
	items?: MenuItemData[];
	current?: string;
} & Click;

type MenuProps = {
	data: MenuItemData;
} & Click;


export const UiRoutedMenu: Component<MenuProps> = (props) => {
	return <MenuItemGroup data={props.data} onClickLink={props.onClickLink} />;
};

export const UiTreeMenu: Component<MenuProps> = (props) => {
	// context current path

	const loacationContext = createContext ( 123 );
	return <MenuItemGroup data={props.data} onClickLink={props.onClickLink} />;
};

type ItemProps<P = {}> = P & {
	collapsed?: boolean;
	data: MenuItemData[];
};

type ParentComponent<P = {}> = Component<ItemProps<P>>;

const MenuItem: ParentComponent<MenuItemData> = (props: MenuItemData) => {
	const collapsed = $<boolean>(true);
	return () => (
		<div class={styles.item}>
			<a
				class={`${styles.link}`}
				onClick={(event) => {
					collapsed(!collapsed());
					event.preventDefault();
					props.onClickLink(props.link);
				}}
				href={props.link}
			>
				{props.name}
			</a>

			<If when={!collapsed()}>
				<div class={styles.sub_item}>
					<MenuItemGroup data={props.items} onClickLink={props.onClickLink} />
				</div>
			</If>
		</div>
	);
};

const MenuItemGroup: ParentComponent<ItemProps> = (props: ItemProps) => {
	return () => (
		<>
			{props.data.map((item) => (
				<MenuItem {...item} onClickLink={props.onClickLink} />
			))}
		</>
	);
};
