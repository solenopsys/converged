import { createHttpBackend } from "nrpc";
import { metadata } from "g-equipment";
import serviceImpl from "./index";

export default createHttpBackend({ metadata, serviceImpl });
