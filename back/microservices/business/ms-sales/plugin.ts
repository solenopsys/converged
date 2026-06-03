import { metadata } from "g-sales";
import { createHttpBackend } from "nrpc";
import serviceImpl from "./index";

export default createHttpBackend({
	metadata,
	serviceImpl,
});
