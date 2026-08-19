import { createFrontNrpcClientConfig } from "signal-channel";
import { createScriptsServiceClient } from "g-scripts";

export default createScriptsServiceClient(createFrontNrpcClientConfig());
