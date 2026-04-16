import { CreateAction, CreateWidget } from "front-core";
import { StaticCacheView } from "./views/StaticCacheView";

const SHOW_STATIC_CACHE = "static.cache.show";

const createStaticCacheWidget: CreateWidget<typeof StaticCacheView> = (_bus) => ({
  view: StaticCacheView,
  placement: () => "center",
  config: {},
});

const createShowStaticCacheAction: CreateAction<any> = (bus) => ({
  id: SHOW_STATIC_CACHE,
  description: "Show static SSR cache",
  invoke: () => {
    bus.present({ widget: createStaticCacheWidget(bus) });
  },
});

const ACTIONS = [createShowStaticCacheAction];

export { SHOW_STATIC_CACHE };
export default ACTIONS;
