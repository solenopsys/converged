import { useNavigate } from "@solenopsys/converged-router";
import { UiContext } from "./consts";
import { UiEvents } from "@solenopsys/converged-renderer";
import $ from "@solenopsys/converged-reactive";

import { useContext, loadModule } from "@solenopsys/converged-renderer";

export class AdaptiveRouter {
	constructor(private routes: any) {
		this.initEffects();   
	}

    public pathToEvent(){
        UiEvents({
			type: "navigate",
			location: window.location.pathname,
			cancelNavigation: true,
		});
    }

	initEffects() {
		const navigate = useNavigate();
		const uiState: any = useContext(UiContext);

		$.effect(() => {
			const event:any = UiEvents();
			if (event.type === "navigate") {
				if (!event.cancelNavigation) {
					navigate(`${event.location}`);
				}

				const rt = this.routes[event.location];

				for (const key in rt) {
					uiState[key] = rt[key];
				}
			}
		});
	}
}
