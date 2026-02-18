import { SHOW_DEFAULT_LANDING } from "./functions";
import { getLandingMenuTitle } from "./env";

export const MENU = {
  title: "Landing",
  iconName: "IconGlobe",
  items: [
    {
      title: getLandingMenuTitle(),
      key: "4ir",
      action: SHOW_DEFAULT_LANDING,
    },
  ],
};
