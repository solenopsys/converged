// Bun dev server — serves static HTML and proxies API to gateway
const GATEWAY = process.env.GATEWAY_URL ?? "http://localhost:8090";
const PORT = parseInt(process.env.PORT ?? "3000");

const html = await Bun.file(import.meta.dir + "/index.html").text();

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Serve index.html for root
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    // Proxy API calls to gateway
    if (
      url.pathname.startsWith("/health") ||
      url.pathname.startsWith("/sessions") ||
      url.pathname.startsWith("/user/") ||
      url.pathname.startsWith("/context/") ||
      url.pathname.startsWith("/record/") ||
      url.pathname.startsWith("/transcript/") ||
      url.pathname.startsWith("/signal/")
    ) {
      const target = GATEWAY + url.pathname + url.search;
      const proxied = await fetch(target, {
        method: req.method,
        headers: req.headers,
        body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      });
      return new Response(proxied.body, {
        status: proxied.status,
        headers: proxied.headers,
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`centimanus web client: http://localhost:${PORT}`);
console.log(`Proxying API to: ${GATEWAY}`);
