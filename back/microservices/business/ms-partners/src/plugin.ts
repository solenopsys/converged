import { createHttpBackend } from "nrpc";
import { metadata } from "g-partners";
import serviceImpl from "./index";

export default createHttpBackend({ metadata, serviceImpl });
