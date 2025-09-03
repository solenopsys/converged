
import  Login  from "./components/Login";
import {Socials} from "./components/Socials";

const LoginCap = {
    description: "Авторизация пользователя",
    views: [Login],
    show: ["full"],
    commands: { "auth": { name: open  } },
}

const SocialCap = {
    description: "Через соцсети",
    views: [Socials],
    show: ["full"],
    commands: { "auth": { name: open  } },
}

const LogoutCap = {
    description: "Через соцсети",
    exec: ()=>{}, 
}


export const CAPABILITIES = {
    "login": LoginCap,
    "login_social": SocialCap,
    "logout": LogoutCap,
}
 