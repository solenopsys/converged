import { createHttpBackend } from "nrpc";
import { metadata } from "g-charts";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
