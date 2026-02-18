import { createHttpBackend } from "nrpc";
import { metadata } from "g-usage";
import serviceImpl from "./index";

export default createHttpBackend({ metadata, serviceImpl });
