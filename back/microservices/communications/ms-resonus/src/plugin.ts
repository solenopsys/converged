import { metadata } from "g-resonus";
import { createHttpBackend } from "nrpc";
import { ResonusServiceImpl } from "./service";

// Resonus configuration is a regular scoped NRPC service. Signaling is owned
// by Fujin; this service contains no HTTP or WebSocket relay routes.
export default createHttpBackend({
	metadata,
	serviceImpl: new ResonusServiceImpl(),
});
