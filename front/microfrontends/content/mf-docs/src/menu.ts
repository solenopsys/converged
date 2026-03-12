import { SHOW_DOCS_HOME } from "./functions";
import { getDocsSources } from "./env";

const firstSource = getDocsSources()[0];

export const MENU = {
  title: "Docs",
  iconName: "IconBook",
  items: [
    {
      title: firstSource?.name ?? "docs",
      key: firstSource?.name ?? "docs",
      action: SHOW_DOCS_HOME,
    },
  ],
};
