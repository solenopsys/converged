import { createHttpBackend } from "nrpc";
import { metadata } from "g-kubernetes";
import serviceImpl from "./service";

export default createHttpBackend({ metadata, serviceImpl });
