import { createClassifierServiceClient } from "g-classifier";
import { createFrontNrpcClientConfig } from "signal-channel";

export default createClassifierServiceClient(createFrontNrpcClientConfig());
