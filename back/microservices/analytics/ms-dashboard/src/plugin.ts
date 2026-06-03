import { metadata } from "g-dashboard";
import { createHttpBackend } from "nrpc";
import serviceImpl from "./index";

export default createHttpBackend({
	metadata,
	serviceImpl,
});
