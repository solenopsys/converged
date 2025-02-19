import { Component, useContext } from "@solenopsys/converged-renderer";
import { UiContext,AdaptiveRouter } from "@solenopsys/ui-state";
import { SiteLayout } from "@solenopsys/ui-layouts";
import "./layout.css";

interface Props {
	[path: string]: any;
}

export const Site: Component<Props> = (props) => {
	const uiState: any = useContext(UiContext);

	const adaptiveRouter=new AdaptiveRouter(props.routes)
	adaptiveRouter.pathToEvent()

	uiState.top = {
		component: props.ui.top,
		props: {
			logo: { image: props.page.logo },
			tabs: {
				tabs: props.navigation.tree.map((item: any) => ({
					id: item.id,
					title: item.title,
				})),
			},
			actions: props.actions

		},
	};

	for (const key in props) {
		uiState[key] = props[key];
	}

	return <SiteLayout />;
};
