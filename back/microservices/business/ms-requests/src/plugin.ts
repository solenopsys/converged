import { createHttpBackend } from "nrpc";
import { metadata } from "g-requests";
import serviceImpl from "./index";

export default createHttpBackend({ metadata, serviceImpl });
