import { createHttpBackend } from "nrpc";
import { metadata } from "g-scripts";
import serviceImpl from "./index";

export default createHttpBackend({
	metadata,
	serviceImpl,
});
