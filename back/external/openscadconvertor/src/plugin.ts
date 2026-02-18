import { createHttpBackend } from "nrpc";
import { metadata } from "g-openscadconvertor";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
