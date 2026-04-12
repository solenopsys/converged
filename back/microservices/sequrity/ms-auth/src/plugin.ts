import { Elysia } from "elysia";
import { createHttpBackend } from "nrpc";
import { metadata } from "g-auth";
import { AuthServiceImpl } from "./service";

const frontendUrl =
  process.env.MAGIC_HOST ??
  process.env.FRONTEND_URL ??
  "http://localhost:3000";

export default (options: any) => (app: Elysia) => {
  const impl = new AuthServiceImpl();

  const nrpc = createHttpBackend({ metadata, serviceImpl: impl })(options)(app);

  const handleVerify = async (
    token: string | undefined,
    set: Record<string, any>,
  ) => {
    if (!token) {
      set.status = 400;
      return { error: "Missing token" };
    }
    try {
      const result = await impl.verifyLink(token);
      const redirectUrl = new URL(result.returnTo || "/", frontendUrl);
      redirectUrl.searchParams.set("auth_token", result.token);
      set.status = 302;
      set.headers["location"] = redirectUrl.toString();
    } catch (e: any) {
      const redirectUrl = new URL("/", frontendUrl);
      redirectUrl.searchParams.set("auth_error", e.message ?? "invalid_token");
      set.status = 302;
      set.headers["location"] = redirectUrl.toString();
    }
  };

  nrpc.get("/auth/verify", async ({ query, set }: any) =>
    handleVerify(query?.token as string | undefined, set),
  );

  nrpc.get("/auth/verify/:token", async ({ params, set }: any) =>
    handleVerify(params?.token as string | undefined, set),
  );

  return nrpc;
};
