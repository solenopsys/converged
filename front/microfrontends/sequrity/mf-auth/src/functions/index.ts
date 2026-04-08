import { createShowLoginAction, createAuthAction } from "./login";
import { createLogoutAction } from "./logout";
import { createShowSocialLoginAction } from "./social";
import { createSendMagicLinkAction } from "./send-magic-link";

export const ACTIONS = [
    createShowLoginAction,
    createAuthAction,
    createLogoutAction,
    createShowSocialLoginAction,
    createSendMagicLinkAction,
]

