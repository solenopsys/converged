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

export { createShowStaticCacheAction, SHOW_STATIC_CACHE };
export default [createShowStaticCacheAction];
