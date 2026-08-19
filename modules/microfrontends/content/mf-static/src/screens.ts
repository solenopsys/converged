import { defineScreens } from "front-core/core";
import { $screen } from "./domain-static";
import { StaticCacheView } from "./views/StaticCacheView";

export const SCREENS = defineScreens([
  {
    id: "static.cache",
    when: $screen,
    is: "cache",
    view: StaticCacheView,
    surface: "center",
    title: "Статический кэш",
  },
]);
