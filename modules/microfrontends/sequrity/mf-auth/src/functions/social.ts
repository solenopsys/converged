import { sample } from "effector";
import { type CreateAction, type CreateWidget, present } from "front-core";
import domain from "../domain";
import SocialView from "../views/SocialView";

const SHOW_SOCIAL = "show_social";

const authSocialFx = domain.createEffect<any, any>();
const authSocialEvent = domain.createEvent<{
	credentials?: any;
	social?: string;
}>();
sample({ clock: authSocialEvent, target: authSocialFx });

const createSocialsWidget: CreateWidget<typeof SocialView> = () => ({
	view: SocialView,
	placement: () => "full",
	commands: {
		auth: authSocialEvent,
	},
});

const createShowSocialLoginAction: CreateAction<any> = (bus) => ({
	id: SHOW_SOCIAL,
	invoke: () => {
		bus.present({ widget: createSocialsWidget(bus) });
	},
});

export { createShowSocialLoginAction, SHOW_SOCIAL };
