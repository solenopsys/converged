import { createAuthServiceClient } from "g-auth";

export const authClient = createAuthServiceClient({ baseUrl: "/services" });

export type TemporaryAuthSession = {
  token: string;
  userId: string;
  email: string;
  temporary: true;
};
