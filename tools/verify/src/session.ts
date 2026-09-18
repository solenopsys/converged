/**
 * Mint a sign-in link for a verification actor, the way the gateway would mail one.
 *
 * A story signs in through the same door a person does — `/auth/verify?token=`
 * sets the refresh cookie and the SPA takes it from there — so nothing about
 * the session a test gets is test-only. The one step skipped is the letter: the
 * token comes straight from rp-auth instead of out of a mailbox.
 *
 * The address has to be allowed in, exactly as for a person. A new actor gets an
 * invitation carrying its role, which the gateway consumes on the first sign-in;
 * an existing one is only asked for a new link. One stable address per role
 * keeps reruns from filling identity with a user per test.
 *
 * Runs under Bun as a child of the Playwright worker, because the call has to
 * go where the UI gateway's calls go: over Fujin ZMQ with SERVICE_TOKEN. The
 * WebSocket side only admits user JWTs, and `getMagicLink` is internal.
 * Prints `{ "token": ..., "email": ... }`.
 */
import { parseArgs } from "node:util";

export const ROLES = ["root", "owner", "manager", "operator", "viewer"];

export function actorEmail(role: string): string {
	const domain = process.env.VERIFY_EMAIL_DOMAIN?.trim() || "verify.local";
	return `verify-${role}@${domain}`;
}

async function main(): Promise<void> {
	const { values } = parseArgs({
		options: {
			role: { type: "string" },
			"return-to": { type: "string", default: "/console/" },
		},
	});
	const role = values.role ?? "";
	if (!ROLES.includes(role)) {
		throw new Error(
			`[verify] unknown role "${role}", expected one of ${ROLES.join(", ")}`,
		);
	}

	// Fujin keeps one ZMQ identity per target, last registration wins: borrowing
	// `ui` or `services` would steal the running stack's replies. A name of our
	// own per process cannot collide with anything, including a previous run.
	process.env.FUJIN_TARGET = `verify-${process.pid}`;
	process.env.FUJIN_ZMQ_ENDPOINT ||= "tcp://127.0.0.1:5557";
	const { createServerNrpcClientConfig, getMsMessagingRuntime } = await import(
		"back-core/fujin-services"
	);
	const { createAuthServiceClient } = await import("g-auth");
	const { createIdentityServiceClient } = await import("g-identity");

	const runtime = getMsMessagingRuntime();
	await runtime?.start();
	try {
		const config = createServerNrpcClientConfig();
		const identity = createIdentityServiceClient(config);
		const email = actorEmail(role);

		// root is not something an invitation grants; it only comes from ROOT_EMAIL.
		if (role !== "root" && !(await identity.getUserByEmail(email))) {
			if (!(await identity.getInviteByEmail(email))) {
				await identity.createInvite({
					email,
					preset: role,
					invitedBy: "verification",
				});
			}
		}

		const link = await createAuthServiceClient(config).getMagicLink(
			email,
			values["return-to"],
		);
		process.stdout.write(`${JSON.stringify({ token: link.token, email })}\n`);
	} finally {
		await runtime?.close();
	}
}

if (import.meta.main) {
	main().then(
		() => process.exit(0),
		(error) => {
			console.error(error instanceof Error ? error.message : error);
			process.exit(1);
		},
	);
}
