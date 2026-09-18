import { createSupportServiceClient } from "g-support";
import { createThreadsServiceClient } from "g-threads";
import { createFrontNrpcClientConfig } from "signal-channel";

/**
 * Every method on `rp-support` answers a browser, and the narrowing happens
 * inside it: a feature is visible to everybody, a bug only to its author and
 * the team, and `setStatus` only to the team. So this surface asks plainly and
 * gets back exactly what the caller is allowed to see — there is no filtering
 * to do here, and doing any would be a second, weaker copy of the rule.
 */
export const supportClient = createSupportServiceClient(
	createFrontNrpcClientConfig(),
);

/**
 * The ticket's description, replies and files all live in a thread.
 *
 * `rp-support` cannot open one — repositories do not call each other — so the
 * thread is minted here, registered here, and only then handed to
 * `createTicket`. That ordering is not a preference: a ticket whose thread does
 * not exist is a ticket nobody can describe.
 */
export const threadsClient = createThreadsServiceClient(
	createFrontNrpcClientConfig(),
);

const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * A ULID minted in the browser, because the thread has to exist before the
 * ticket does and only the client stands between the two services.
 *
 * Time prefix plus randomness, the standard layout: threads sort by creation
 * without a second column, and two tabs opened in the same millisecond still
 * get different ids. This is an identifier, never a secret — nothing is
 * authorised by holding it, and `registerThread` stamps the real owner.
 */
export function mintThreadId(): string {
	let timestamp = Date.now();
	const time: string[] = [];
	for (let i = 0; i < 10; i += 1) {
		time.unshift(ULID_ALPHABET[timestamp % 32]);
		timestamp = Math.floor(timestamp / 32);
	}
	const random = new Uint8Array(16);
	crypto.getRandomValues(random);
	const tail = Array.from(random, (byte) => ULID_ALPHABET[byte % 32]).join("");
	return time.join("") + tail;
}
