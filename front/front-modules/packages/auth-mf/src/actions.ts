import Login from "./components/Login";
import { Socials } from "./components/Socials";
import { Widget, Action,present  } from 'converged-core';
import {createEvent, createEffect} from "effector";

// Events and Effects
export const authEvent = createEvent<{ credentials?: any; social?: string }>();
export const logoutEvent = createEvent();
export const authFx = createEffect<any, any>(); // Подключить к authService
export const logoutFx = createEffect();

// Widgets
const LoginWidget: Widget<typeof Login> = {
    view: Login,
    placement: (ctx) => "full",
    mount: () => {
        // Initialization logic if needed
    },
    commands: {
        auth: (credentials) => authEvent({ credentials })
    }
};

const SocialsWidget: Widget<typeof Socials> = {
    view: Socials,
    placement: (ctx) => "full",
    mount: () => {
        // Initialization logic if needed
    },
    commands: {
        auth: (socialData) => authEvent({ social: socialData })
    }
};

// Actions
const ShowLoginAction: Action = {
    id: "auth.show_login",
    description: "Показать форму авторизации",
    invoke: () => {
        present(LoginWidget);
    }
};

const ShowSocialLoginAction: Action = {
    id: "auth.show_social",
    description: "Авторизация через соцсети",
    invoke: () => {
        present(SocialsWidget);
    }
};

const AuthAction: Action = {
    id: "auth.login",
    description: "Авторизация пользователя",
    invoke: (authData) => {
        authEvent(authData);
    }
};

const LogoutAction: Action = {
    id: "auth.logout",
    description: "Выход из системы",
    invoke: () => {
        logoutEvent();
    }
};

// Sample connections (добавить когда будет authService)
// import { sample } from "effector";
// sample({ clock: authEvent, target: authFx });
// sample({ clock: logoutEvent, target: logoutFx });

export{
    LoginWidget,
    SocialsWidget,
    ShowLoginAction,
    ShowSocialLoginAction,
    AuthAction,
    LogoutAction
}

export default [ 
    SocialsWidget,
    ShowLoginAction,
    ShowSocialLoginAction,
    AuthAction,
    LogoutAction
];