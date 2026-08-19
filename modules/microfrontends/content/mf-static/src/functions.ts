import type { CreateAction } from "front-core/core";
import { staticOpened } from "./domain-static";

const SHOW_STATIC_CACHE = "static.cache.show";


const createShowStaticCacheAction: CreateAction<undefined> = () => ({
  id: SHOW_STATIC_CACHE,
  brief: "Open the static SSR page cache",
  category: "static",
  description:
    "Show the SSR static cache: pages with status (todo/loaded/outdated), " +
    "content type, size and load time. Supports flush and invalidation by pattern.",
  invoke: () => {
    staticOpened();
    return { ok: true, entity: "static-cache" };
  },
});

export { SHOW_STATIC_CACHE, createShowStaticCacheAction };
export default [createShowStaticCacheAction];
