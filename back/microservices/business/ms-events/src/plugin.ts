import { metadata } from "g-events";
import { createHttpBackend } from "nrpc";
import serviceImpl from "./index";

export default createHttpBackend({
	metadata,
	serviceImpl,
});
