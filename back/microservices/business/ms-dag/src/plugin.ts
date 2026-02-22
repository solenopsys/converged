import { createHttpBackend } from "nrpc";
import { metadata } from "g-dag";
import serviceImpl from "./service";

export default createHttpBackend({ metadata, serviceImpl });
