import { createShowLoginAction, createAuthAction } from "./login";
import { createLogoutAction } from "./logout";
import { createShowSocialLoginAction } from "./social";


export const ACTIONS = [
    createShowLoginAction,
    createAuthAction,
    createLogoutAction,
    createShowSocialLoginAction
]

