import { createCentimanusServiceClient } from "g-centimanus";
import { createIdentityServiceClient } from "g-identity";
import { createStaffServiceClient } from "g-staff";
import { createFrontNrpcClientConfig } from "signal-channel";

export const staffClient = createStaffServiceClient(
	createFrontNrpcClientConfig(),
);

/**
 * Only the three invitation methods answer a browser.
 *
 * `rp-identity` is an internal service — a console must not be able to
 * enumerate or edit users — but "who was invited and did their letter arrive"
 * is a column on a screen. Those three carry `@Access("user")` and are gated by
 * the grant `rp/identity/listInvites(r)`, which lives in the owner and manager
 * presets. Anything else on this client will be refused by the runtime, which
 * is the intended outcome, not a bug to work around.
 */
export const identityClient = createIdentityServiceClient(
	createFrontNrpcClientConfig(),
);

/**
 * The workflow VM, and the only way this surface can touch access at all.
 *
 * `rp-access` refuses a user JWT outright, so granting a role is not something
 * a screen can do: it asks centimanus to run wf-team-invite, which holds the
 * cluster's service token. The long deadline is because one run walks a list of
 * people through four services and a mail relay.
 */
export const workflowClient = createCentimanusServiceClient(
	createFrontNrpcClientConfig({ deadlineMs: 300_000 }),
);

export const TEAM_INVITE_SCRIPT = "workflows/wf-team-invite.js";
