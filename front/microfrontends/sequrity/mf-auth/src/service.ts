import { createAuthServiceClient } from "g-auth";

export const authClient = createAuthServiceClient({ baseUrl: "/services" });
