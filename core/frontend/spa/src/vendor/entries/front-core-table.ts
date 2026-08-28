/**
 * The table is its own file, not part of the shared core bundle: not every
 * microfrontend uses it, and it weighs more than the rest. `front-core` stays
 * external — primitives and `cn` come from it, and no second copy appears.
 *
 * The path is relative, not by entrypoint name: `front-core` in the external
 * list also matches a subpath, so the bundler would have left `export * from
 * "front-core/table"` external — the file would have compiled into a re-export of itself.
 */
export * from "../../../../front-core/src/table";
