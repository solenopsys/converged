import * as anatomy from "@zag-js/anatomy";
import * as core from "@zag-js/core";
import * as domQuery from "@zag-js/dom-query";
import * as focusVisible from "@zag-js/focus-visible";
import * as popper from "@zag-js/popper";
import * as store from "@zag-js/store";
import * as types from "@zag-js/types";
import * as utils from "@zag-js/utils";

/**
 * All of Zag in one file: the adapter, the tooltip machine, and the shared
 * runtime. Split apart they still pulled in one shared chunk, so three files
 * only meant more requests.
 */

export { normalizeProps, useMachine } from "@zag-js/preact";
export * from "@zag-js/select";
export * from "@zag-js/tooltip";

// Common Zag runtime stays in the base vendor layer, not inside one widget.
export const runtime = {
  anatomy,
  core,
  domQuery,
  focusVisible,
  popper,
  store,
  types,
  utils,
};
