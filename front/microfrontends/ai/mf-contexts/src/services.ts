import { createContextsServiceClient } from "g-contexts";

export const contextsClient = createContextsServiceClient({
  baseUrl: "/services",
});
