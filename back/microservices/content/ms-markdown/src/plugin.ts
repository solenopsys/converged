import { createHttpBackend } from "nrpc";
import { metadata } from "g-markdown";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
