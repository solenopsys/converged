 
import {  CreateAction } from 'converged-core';
import { sample } from "effector";
import domain from "../domain";

const LOGOUT = "logout";

const logoutFx = domain.createEffect<any, any>();
const logoutEvent = domain.createEvent();
sample({ clock: logoutEvent, target: logoutFx });

const createLogoutAction: CreateAction<any> = () => ({
    id: LOGOUT,
    description: "Logout user",
    invoke: logoutEvent
});

export {
    LOGOUT,
    createLogoutAction
};