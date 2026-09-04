import { createMarkdownServiceClient } from "g-markdown";
import { createFrontNrpcClientConfig } from "signal-channel";

export default createMarkdownServiceClient(createFrontNrpcClientConfig());
