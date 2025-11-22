import {Fragment} from "./index.js";
import {createElement} from "./index.js";
const jsx = (component, props) => {
  return createElement(component, props);
};

export { jsx, jsx as jsxs, jsx as jsxDEV, Fragment };
