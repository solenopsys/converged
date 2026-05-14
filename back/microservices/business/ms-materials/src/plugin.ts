import { createHttpBackend } from "nrpc";
import { metadata } from "g-materials";
import serviceImpl from "./index";

export default createHttpBackend({ metadata, serviceImpl });
