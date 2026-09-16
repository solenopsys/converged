import addLocale from "./addLocale";
import addScopedLayouts from "./addScopedLayouts";
import addSurfaceLayout from "./addSurfaceLayout";
import createUserEnvironment from "./createUserEnvironment";

export default [
	createUserEnvironment,
	addSurfaceLayout,
	addScopedLayouts,
	addLocale,
];
