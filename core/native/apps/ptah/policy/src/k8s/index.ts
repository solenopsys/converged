/**
 * Builders for every object shape the controller applies — plain data, no
 * cdk8s and no Helm templating, because the controller sends them straight to
 * the apiserver as a server-side apply patch.
 *
 * One module per resource family. The set of files here is also the set of
 * things ptah is allowed to write: adding a kind means a new module plus an
 * entry in the GVK table in `src/kube.zig`, and both are deliberate.
 */

export * from "./certificate.ts";
export * from "./config.ts";
export * from "./container.ts";
export * from "./gateway.ts";
export * from "./service.ts";
export * from "./volume.ts";
export * from "./workload.ts";
