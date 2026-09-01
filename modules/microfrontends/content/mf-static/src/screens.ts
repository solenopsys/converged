import { defineScreens } from "front-core/core";
import { resolveEmbeddedMicrofrontendMessage } from "front-core";
import { $screen } from "./domain-static";
import { StaticCacheView } from "./views/StaticCacheView";

export const SCREENS = defineScreens([
  {
    id: "static.cache",
    when: $screen,
    is: "cache",
    view: StaticCacheView,
    surface: "center",
    title: (_value: unknown) =>
      (resolveEmbeddedMicrofrontendMessage("mf-static", "screens.cache.title") as
        | string
        | undefined) ?? "Static Cache",
  },
]);
