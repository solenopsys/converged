import { createFunctionsServiceClient } from "g-functions";

export const functionsClient = createFunctionsServiceClient({
  baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
});
