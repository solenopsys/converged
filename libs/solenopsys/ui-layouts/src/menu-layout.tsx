//@ts-ignore
import styles from "./styles/menu-layout.module.css";
import $ from "@solenopsys/converged-reactive";
import {
	Component,
	DynamicLazy,
	If,
	useContext,
	lazy,
	useMemo,
} from "@solenopsys/converged-renderer";

import { UiContext } from "@solenopsys/ui-state";




export const CenterComponent: Component<any> = (props: any) => {
	const uiState: any = useContext(UiContext);

	return () => (
		<div class={uiState.left? styles.main_content_wm:styles.main_content} >
			<If when={ uiState.center}>
				<DynamicLazy
					component={uiState.center?.component}
					props={uiState.center?.props}
				/>
			</If>
		</div>
	);
};

export const MenuLayout: Component<any> = (props: any) => {
	console.log("MENU LAYOUT", props);
	const uiState: any = useContext(UiContext);

	const mobileMenu = $(false);

	return () => {
		console.log("MENU LAYOUT STATE2", uiState.center);

		return (
			<>
				<div class={styles.left_block}>
					<div
						class={mobileMenu() ? styles.main_menu_mobile : styles.main_menu}
					>
						<If when={uiState.left}>
							<div class={styles.main_menu_wrapper}>
								<div class={styles.scrollable}>
									<DynamicLazy {...uiState.left} />
								</div>
							</div>
						</If>
					</div>
				</div>
				<CenterComponent />
			</>
		);
	};
};
