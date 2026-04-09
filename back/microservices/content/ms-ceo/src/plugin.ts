import { createHttpBackend } from "nrpc";
import { metadata } from "g-ceo";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
