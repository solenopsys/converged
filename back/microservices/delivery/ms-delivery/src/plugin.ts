import { createHttpBackend } from "nrpc";
import { metadata } from "g-delivery";
import serviceImpl from "./index";

export default createHttpBackend({ metadata, serviceImpl });
