/**
 * Project entry used by the SPA build. The Converged landing implementation
 * currently lives in the shared landing package; keeping this boundary lets
 * the project replace its block map without changing the build pipeline.
 */
export { blocks, brand, header } from "../../../../core/frontend/landing/src/blocks";
