import { metadata } from "g-counters";
import { createHttpBackend } from "nrpc";
import serviceImpl from "./index";

export default createHttpBackend({ metadata, serviceImpl });
