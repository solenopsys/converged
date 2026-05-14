import { createHttpBackend } from "nrpc";
import { metadata } from "g-orders";
import serviceImpl from "./index";

export default createHttpBackend({ metadata, serviceImpl });
