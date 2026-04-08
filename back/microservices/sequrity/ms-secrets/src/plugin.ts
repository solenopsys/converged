import { createHttpBackend } from "nrpc";
import { metadata } from "g-secrets";
import serviceImpl from "./index";

export default createHttpBackend({ metadata, serviceImpl });
