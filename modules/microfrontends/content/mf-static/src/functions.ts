import type { CreateAction } from "front-core/core";
import { staticOpened } from "./domain-static";

const SHOW_STATIC_CACHE = "static.cache.show";


const createShowStaticCacheAction: CreateAction<undefined> = () => ({
  id: SHOW_STATIC_CACHE,
  invoke: () => {
    staticOpened();
    return { ok: true, entity: "static-cache" };
  },
});

export { SHOW_STATIC_CACHE, createShowStaticCacheAction };
export default [createShowStaticCacheAction];
