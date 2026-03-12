import SocialView  from "../views/SocialView";
import { CreateWidget, CreateAction, present } from 'front-core';
import { sample } from "effector";
import domain from "../domain";

const SHOW_SOCIAL = "show_social";

const authSocialFx = domain.createEffect<any, any>();
const authSocialEvent = domain.createEvent<{ credentials?: any; social?: string }>();
sample({ clock: authSocialEvent, target: authSocialFx });

const createSocialsWidget: CreateWidget<typeof SocialView> = () => ({
    view: SocialView,
    placement: () => "full",
    commands: {
        auth:  authSocialEvent
    }
});

const createShowSocialLoginAction: CreateAction<any> = (bus) => ({
    id: SHOW_SOCIAL,
    description: "Show social login",
    invoke: () => {
        bus.present({ widget: createSocialsWidget(bus) });
    }
});

export {
    SHOW_SOCIAL,
    createShowSocialLoginAction
};