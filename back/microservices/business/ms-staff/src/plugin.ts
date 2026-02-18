import { createHttpBackend } from "nrpc";
import { metadata } from "g-staff";
import serviceImpl from "./index";

export default createHttpBackend({ metadata, serviceImpl });
