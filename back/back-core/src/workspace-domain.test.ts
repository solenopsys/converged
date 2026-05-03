import { describe, expect, test } from "bun:test";
import {
  buildWorkspaceHeaders,
  parseWorkspaceDomainMap,
  resolveWorkspaceFromDomain,
  resolveWorkspaceFromHeaders,
  resolveWorkspaceFromRequest,
} from "./workspace-domain";

describe("workspace-domain", () => {
  test("resolves exact and wildcard domains", () => {
    const map = parseWorkspaceDomainMap(
      JSON.stringify({
        "alpha.example.com": "alpha",
        "*.saas.example.com": "tenant",
      }),
    );

    expect(resolveWorkspaceFromDomain("alpha.example.com:443", { map })).toBe(
      "alpha",
    );
    expect(resolveWorkspaceFromDomain("team.saas.example.com", { map })).toBe(
      "tenant",
    );
    expect(
      resolveWorkspaceFromDomain("saas.example.com", { map }),
    ).toBeUndefined();
  });

  test("prefers forwarded host and explicit workspace header", () => {
    const map = {
      "public.example.com": "public",
      "internal.local": "internal",
    };
    const request = new Request("https://internal.local/", {
      headers: {
        host: "internal.local",
        "x-forwarded-host": "public.example.com",
      },
    });

    expect(resolveWorkspaceFromRequest(request, { map })).toBe("public");

    const explicit = new Request("https://internal.local/", {
      headers: {
        workspace: "direct",
        "x-forwarded-host": "public.example.com",
      },
    });

    expect(resolveWorkspaceFromRequest(explicit, { map })).toBe("direct");
  });

  test("resolves runtime headers through the same domain map", () => {
    expect(
      resolveWorkspaceFromHeaders(
        { host: "runtime.example.com" },
        { map: { "runtime.example.com": "runtime-tenant" } },
      ),
    ).toBe("runtime-tenant");
  });

  test("keeps headers optional", () => {
    expect(buildWorkspaceHeaders(undefined)).toEqual({});
    expect(buildWorkspaceHeaders("alpha")).toEqual({ workspace: "alpha" });
  });
});
