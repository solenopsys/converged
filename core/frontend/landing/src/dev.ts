import spaPlugin from "front-spa/plugin";
import landingPlugin from "./plugin";
import {
	requiredLandingEnv,
	startLandingDevServer,
} from "./dev-server";

const projectDir = requiredLandingEnv("PROJECT_DIR");
const production = process.env.NODE_ENV === "production";

await startLandingDevServer({
	name: "converged-landing",
	projectDir,
	spa: spaPlugin({ production }),
	landing: landingPlugin({ production }),
});
