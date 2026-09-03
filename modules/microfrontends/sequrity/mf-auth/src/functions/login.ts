import type { CreateAction, CreateWidget } from "front-core";
import LoginView from "../views/LoginView";

export const SHOW_LOGIN = "auth.show-login";

const createLoginWidget: CreateWidget<typeof LoginView> = (bus) => ({
	view: LoginView,
	placement: () => "sidebar:tab:auth",
	config: { bus },
	commands: {},
});

export const createShowLoginAction: CreateAction<any> = (bus) => ({
	id: SHOW_LOGIN,
	access: "public",
	invoke: () => bus.present({ widget: createLoginWidget(bus) }),
});

export const createAuthAction: CreateAction<any> = () => ({
	id: "auth.login",
	access: "public",
	invoke: () => {},
});
