import { createAuthServiceClient } from "g-auth";
import { createRuntimeServiceClient } from "g-runtime";

export const authClient = createAuthServiceClient({ baseUrl: "/services" });
export const runtimeClient = createRuntimeServiceClient({ baseUrl: "/services" });

export async function sendMagicLink(email: string, returnTo?: string): Promise<void> {
  await runtimeClient.sendMagicLink({ email, returnTo });
}

export type TemporaryAuthSession = {
  token: string;
  userId: string;
  email: string;
  temporary: true;
};
