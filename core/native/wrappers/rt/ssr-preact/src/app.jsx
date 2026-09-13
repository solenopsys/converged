import { h } from "preact";
import render from "preact-render-to-string";

function Page({ path }) {
  const title = path === "/about" ? "About" : "Home";
  return h(
    "html",
    null,
    h("head", null, h("title", null, title)),
    h(
      "body",
      null,
      h("h1", null, title),
      h(
        "nav",
        null,
        h("a", { href: "/" }, "Home"),
        " | ",
        h("a", { href: "/about" }, "About"),
      ),
      h("p", null, "Rendered on " + path),
    ),
  );
}

// Deterministic CPU workload: 32-bit integer hash chain. Same result on
// every engine (JSC/V8/QuickJS) — the bench harness compares it exactly,
// so any engine divergence shows up as a mismatch, not noise.
function calcChecksum(iterations) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < iterations; i++) {
    h ^= Math.imul(i + 1, 2654435761);
    h = Math.imul(h ^ (h >>> 13), 16777619) >>> 0;
  }
  return h >>> 0;
}

const CALC_DEFAULT_ITERATIONS = 100000;
const CALC_MAX_ITERATIONS = 1000000;

function handleCalc(path) {
  let iterations = CALC_DEFAULT_ITERATIONS;
  const marker = "?iterations=";
  const q = path.indexOf(marker);
  if (q >= 0) {
    const n = parseInt(path.slice(q + marker.length), 10);
    if (Number.isSafeInteger(n) && n >= 1 && n <= CALC_MAX_ITERATIONS)
      iterations = n;
  }
  const result = calcChecksum(iterations);
  return JSON.stringify({
    status: 200,
    headers: [["content-type", "application/json; charset=utf-8"]],
    body: JSON.stringify({ result, iterations }),
  });
}

// Engine-neutral SSR convention shared by JSC, QuickJS and V8:
// sync handler, UTF-8 JSON in, UTF-8 JSON out. No fetch, no fs, no sockets.
globalThis.__crullerHandle = function (input) {
  let request;
  try {
    request = JSON.parse(input);
  } catch {
    return JSON.stringify({
      status: 400,
      headers: [["content-type", "text/plain; charset=utf-8"]],
      body: "bad request",
    });
  }
  const path =
    typeof request.path === "string" && request.path.length > 0
      ? request.path
      : "/";
  // /calc — вычислительный ендпоинт для нагрузочных тестов
  // (?iterations=N, default 100000, max 1000000).
  if (path === "/calc" || path.startsWith("/calc?")) return handleCalc(path);
  let body;
  try {
    body = "<!doctype html>" + render(h(Page, { path }));
  } catch (err) {
    return JSON.stringify({
      status: 500,
      headers: [["content-type", "text/plain; charset=utf-8"]],
      body: "render error: " + String((err && err.message) || err),
    });
  }
  return JSON.stringify({
    status: 200,
    headers: [["content-type", "text/html; charset=utf-8"]],
    body,
  });
};
