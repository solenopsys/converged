import { describe, expect, test } from "bun:test";
import { parseDotEnv } from "./dotenv";
import { buildSecretData, renderSecret } from "./secret";

const decode = (value: string) => Buffer.from(value, "base64").toString("utf8");

describe("buildSecretData", () => {
	test("excludes deployment and operator managed routing values", () => {
		const data = buildSecretData({
			ACCESS_JWT_SECRET: "test-secret",
			LLM_GATE_URL: "/",
			STORAGE_TENANT_SERVICES: '{"old":{"host":"old","port":9000}}',
			WORKSPACE_DOMAIN_MAP: '{"old.example":"old"}',
		});

		expect(data.LLM_GATE_URL).toBeUndefined();
		expect(data.STORAGE_TENANT_SERVICES).toBeUndefined();
		expect(data.WORKSPACE_DOMAIN_MAP).toBeUndefined();
		expect(decode(data.ACCESS_JWT_SECRET)).toBe("test-secret");
	});

	test("does not mint a service token from the access secret", () => {
		const data = buildSecretData({ ACCESS_JWT_SECRET: "test-secret" });

		expect(data.LLM_GATE_SERVICES_TOKEN).toBeUndefined();
	});

	test("honours extra exclusions and keeps everything else", () => {
		const data = buildSecretData({ A: "1", B: "2" }, ["B"]);

		expect(Object.keys(data)).toEqual(["A"]);
	});

	test("encodes non-ascii as utf-8", () => {
		const data = buildSecretData({ NAME: "клуб" });

		expect(decode(data.NAME)).toBe("клуб");
	});
});

describe("parseDotEnv", () => {
	test("reads plain, exported, quoted and empty assignments", () => {
		const env = parseDotEnv(
			[
				"# comment",
				"",
				"PLAIN=value",
				"export EXPORTED=value",
				'QUOTED="a b"',
				"SINGLE='a b'",
				"EMPTY=",
				"SPACED = padded ",
			].join("\n"),
		);

		expect(env).toEqual({
			PLAIN: "value",
			EXPORTED: "value",
			QUOTED: "a b",
			SINGLE: "a b",
			EMPTY: "",
			SPACED: "padded",
		});
	});

	test("keeps `#` inside a value but drops a trailing ` #` comment", () => {
		const env = parseDotEnv("URL=https://x/y#frag\nPORT=80 # the port");

		expect(env.URL).toBe("https://x/y#frag");
		expect(env.PORT).toBe("80");
	});

	test("keeps `=` and escapes inside values", () => {
		const env = parseDotEnv('B64=YWJj==\nKEY="line\\nnext"');

		expect(env.B64).toBe("YWJj==");
		expect(env.KEY).toBe("line\nnext");
	});

	test("skips lines that carry no key", () => {
		const env = parseDotEnv("=orphan\nno_equals\n1BAD=x\nGOOD=x");

		expect(Object.keys(env)).toEqual(["GOOD"]);
	});
});

describe("renderSecret", () => {
	test("writes an empty value as a quoted string, not null", () => {
		const yaml = renderSecret({
			name: "club-secrets",
			namespace: "club",
			data: buildSecretData({ SET: "x", UNSET: "" }),
		});

		expect(yaml).toContain('  UNSET: ""');
		expect(yaml).toContain("  SET: eA==");
	});

	test("emits the shape the apiserver expects", () => {
		const yaml = renderSecret({
			name: "club-secrets",
			namespace: "club",
			data: { A: "eA==" },
		});

		expect(yaml).toBe(
			[
				"apiVersion: v1",
				"kind: Secret",
				"metadata:",
				"  name: club-secrets",
				"  namespace: club",
				"type: Opaque",
				"data:",
				"  A: eA==",
				"",
			].join("\n"),
		);
	});
});
