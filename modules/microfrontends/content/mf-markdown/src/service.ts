import { createFrontNrpcClientConfig } from "signal-channel";
import { createMarkdownServiceClient } from "g-markdown";

export default createMarkdownServiceClient(createFrontNrpcClientConfig());
