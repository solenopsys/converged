export const ID = "contexts-mf";
export const GROUP = {
  id: "ai",
  title: "AI",
  iconName: "IconBrain",
};
export { MENU } from "./menu";

import { BasePlugin } from "front-core";
import ACTIONS from "./functions";

export default new BasePlugin(ID, ACTIONS);
