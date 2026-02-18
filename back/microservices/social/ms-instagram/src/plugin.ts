import { createHttpBackend } from "nrpc";
import { metadata } from "g-instagram";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
