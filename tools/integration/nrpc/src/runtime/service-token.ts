import { SignJWT } from "jose";

/**
 * Generates a service account token for internal inter-service calls.
 * Call once at container startup using ACCESS_JWT_SECRET from env.
 *
 * Usage in UI startup:
 *   const token = await generateServiceToken(process.env.ACCESS_JWT_SECRET!);
 *   // pass token to nrpc clients via config.headers
 */
export async function generateServiceToken(secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ perm: ["*/*( rw)"] })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("service-account")
    .setIssuedAt()
    .sign(key);
}
