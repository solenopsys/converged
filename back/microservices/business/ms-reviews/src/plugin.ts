import { createHttpBackend } from "nrpc";
import { metadata } from "g-reviews";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
