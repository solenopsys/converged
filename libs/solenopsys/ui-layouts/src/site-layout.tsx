import { Component, DynamicLazy, If,useContext,lazy,UiContext } from "@solenopsys/converged-renderer";
 
import { Router } from "@solenopsys/converged-router";

// @ts-ignore
import styles from "./styles/site-layout.module.css";
import { MenuLayout } from "./menu-layout";

interface MdItemComponentProps {
	top: string;
	central: string;
	bottom: string;
	components: { [name: string]: Component };
}

export const SiteLayout: Component<MdItemComponentProps> = () => {
	const uiState:any = useContext(UiContext);

	return () => {
		return (
			
		<div class={styles.body_wrapper}>
			<div class={styles.full_height}>
				<div class={styles.top_pane_wrapper}>
					<If when={uiState.top}>
						<DynamicLazy {...uiState.top} />
					</If>
				</div>
				 <MenuLayout  /> 
				 <div>
					<If when={uiState.bottom}>
						<DynamicLazy  {...uiState.bottom} />
					</If>
				</div>  
			</div>
		</div>)
	};
};
