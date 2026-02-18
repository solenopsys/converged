import { Elysia } from "elysia";
import landingPlugin from "./plugin";

const port = Number(process.env.PORT || 3002);

const app = new Elysia({ name: "landing-dev" })
  .use(landingPlugin({ production: false }))
  .get("/health", () => ({ status: "ok" }));

app.listen({ port, hostname: "0.0.0.0" }, () => {
  console.log(`[landing] http://localhost:${port}`);
});
