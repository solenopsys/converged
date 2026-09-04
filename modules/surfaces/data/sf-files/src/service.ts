import { createFilesServiceClient } from "g-files";
import { createFrontNrpcClientConfig } from "signal-channel";

export default createFilesServiceClient(createFrontNrpcClientConfig());
