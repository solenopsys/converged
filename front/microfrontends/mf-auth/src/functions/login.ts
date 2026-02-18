import LoginView from "../views/LoginView";
import { CreateWidget, CreateAction } from "front-core";
import { sample } from "effector";
import domain from "../domain";

const SHOW_LOGIN = "show_login";
const LOGIN = "login";

const authFx = domain.createEffect<any, any>();
const authEvent = domain.createEvent<{ credentials?: any; social?: string }>();
sample({ clock: authEvent, target: authFx });

const createLoginWidget: CreateWidget<typeof LoginView> = () => ({
    view: LoginView,
    placement: () => "sidebar:tab:auth",
    commands: {
        auth: authEvent
    }
});

const createShowLoginAction: CreateAction<any> = (bus) => ({
    id: SHOW_LOGIN,
    description: "Show login form",
    invoke: () => {
        bus.present({ widget: createLoginWidget(bus) });
    }
});

const createAuthAction: CreateAction<any> = () => ({
    id: LOGIN,
    description: "Auth user",
    invoke: authEvent
});

export {
    LOGIN,
    SHOW_LOGIN,
    createShowLoginAction,
    createAuthAction
}
