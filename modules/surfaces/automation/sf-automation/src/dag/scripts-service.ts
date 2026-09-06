import { createScriptsServiceClient } from "g-scripts";
import { createFrontNrpcClientConfig } from "signal-channel";

export default createScriptsServiceClient(createFrontNrpcClientConfig());
