## Adding a module

The steps are the same for the base platform and for a product layer.

1. **Create the directory** by convention: `modules/microservices/<domain>/ms-<name>` for a service, `modules/microfrontends/<domain>/mf-<name>` for a screen, `modules/workflows/wf-<name>` for a process.
2. **Declare the contract** in `modules/types/<domain>/` and generate the clients with `bun run gen`. The client appears as a `g-<name>` package, usable from the browser, from another process on the bus, and from inside a workflow.
3. **Write the README** with a `## Purpose` section and an ownership-boundary section. The first paragraph of each ends up in the registry on the site — write them for a reader, not for yourself.
4. **Add the module to a solution** if it does not ship alone: put its short name in `modules/solutions/solutions.json` and declare its dependencies.
5. **Rebuild the docs**: `bun run docs` in `core/tools/docs`. The module shows up in the registry and the counters on the ecosystem page recount themselves.

What you do not have to do: edit module lists in the site data, restate the description in the landing, or register the module anywhere else. Generation runs one way — from sources into data, never back. Anything under `data/` is overwritten by the next build.

What review asks of a module: it does not reach into another module's storage, does not bypass the bus with direct calls, declares only the permissions it actually uses, and does not quietly widen its area of responsibility.
