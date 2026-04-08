export const ID = "secrets-mf";
export { MENU } from "./menu";

export const SIDEBAR_TABS = [
  {
    id: "secrets",
    title: "Secrets",
    iconName: "IconKey",
    order: 50,
  },
];

import { BasePlugin } from "front-core";
import { ACTIONS } from "./functions";

export default new BasePlugin(ID, ACTIONS);
