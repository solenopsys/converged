import { serve } from "bun";

serve({
  port: 3000,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    if (path === "/") path = "/index.html";

    console.log(`[${req.method}] ${path}`);

    // Handle style and renderer directories
    if (
      path.startsWith("/style/") ||
      path.startsWith("/renderer/") ||
      path.startsWith("/reactive/")
    ) {
      const file = Bun.file(`..${path}`);
      if (await file.exists()) {
        console.log(`  -> 200`);
        return new Response(file);
      }
    }

    const file = Bun.file(`.${path}`);
    if (await file.exists()) {
      console.log(`  -> 200`);
      return new Response(file);
    }

    console.log(`  -> 404`);
    return new Response("Not found", { status: 404 });
  },
});

console.log("Server running at http://localhost:3000");
