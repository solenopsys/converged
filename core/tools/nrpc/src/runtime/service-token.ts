/**
 * Kept as a deliberate migration guard for callers compiled against older
 * NRPC versions. Processes must consume an Ed25519 service JWT issued by
 * rp-access; they must never sign one from ACCESS_JWT_SECRET themselves.
 */
export async function generateServiceToken(): Promise<never> {
  throw new Error("service JWTs must be issued by rp-access and supplied as SERVICE_TOKEN");
}
