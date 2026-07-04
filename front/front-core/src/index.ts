import "./nrpc-client-env";

export * from "./chat/events";
export * from "./components/index";
export * from "./controllers";
export * from "./hooks";
export * from "./i18n";
export * from "./icons-shim";
export * from "./landing-common/context-names";
export * from "./landing-common/control-panel-model";
export * from "./landing-common/HeroBanner";
export * from "./landing-common/HeroInputDock";
export * from "./landing-common/HeroRequestBanner";
export * from "./landing-common/HeroScrollLayout";
export * from "./landing-common/island-client";
export * from "./landing-common/island-loader";
export * from "./landing-common/mic-capture";
export * from "./landing-common/useHeroDock";
// web-call must be exported from the root so external landing bundles fire the
// SAME effector event/store the app's front-core.js singleton watches. Importing
// it via the "front-core/landing-common" subpath inlines a duplicate instance,
// so the click never reaches startWebCall (that was the "call does nothing" bug).
export * from "./landing-common/web-call";
export * from "./landing-common/WebCallWidget";
export * from "./lib/dashboard-chart";
export * from "./lib/utils";
export * from "./plugin";
export * from "./plugin/types_actions";
export * from "./sidebar-tabs";
export * from "./slots";
export * from "./utils";
export * from "./views";
