import type { CreateAction } from "front-core/core";
import { staticOpened } from "./domain-static";

const SHOW_STATIC_CACHE = "static.cache.show";


const createShowStaticCacheAction: CreateAction<undefined> = () => ({
  id: SHOW_STATIC_CACHE,
  brief: "Open the static SSR page cache",
  category: "static",
  llm: {
    microfrontend: "static-mf",
    brief: "llm.actions.static_cache_show.brief",
    description: "llm.actions.static_cache_show.description",
  },
  exposure: "user",
  priority: "normal",
  invoke: () => {
    staticOpened();
    return { ok: true, entity: "static-cache" };
  },
});

export { SHOW_STATIC_CACHE, createShowStaticCacheAction };
export default [createShowStaticCacheAction];
