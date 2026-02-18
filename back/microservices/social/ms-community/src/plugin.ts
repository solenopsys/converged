import { createHttpBackend } from "nrpc";
import { metadata } from "g-community";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
