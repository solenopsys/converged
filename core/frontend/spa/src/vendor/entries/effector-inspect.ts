// This must bypass the import-map specifier: otherwise the generated vendor
// module re-exports itself through `effector/inspect`.
export * from "../../../node_modules/effector/inspect.mjs";
