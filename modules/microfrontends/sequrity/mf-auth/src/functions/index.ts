import { createShowLoginAction, createAuthAction } from "./login";
import { createLogoutAction } from "./logout";
import { createShowSocialLoginAction } from "./social";
import { createEnsureTemporarySessionAction } from "./temporary";

export const ACTIONS = [
    createShowLoginAction,
    createAuthAction,
    createLogoutAction,
    createShowSocialLoginAction,
    createEnsureTemporarySessionAction,
]
