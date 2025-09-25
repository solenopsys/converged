import { getDefaultAuthDatabaseService } from "../db";

const authDb = getDefaultAuthDatabaseService();

export async function requireAuth({ jwt, headers, set }: any) {
	const token = headers.authorization?.replace("Bearer ", "");
	if (!token) {
		set.status = 401;
		throw new Error("Unauthorized");
	}

	const payload = await jwt.verify(token);
	if (!payload) {
		set.status = 401;
		throw new Error("Invalid token");
	}

	// Hash token to find session
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(token);
	const tokenHash = hasher.digest("hex");

	const session = await authDb.sessions.findByTokenHash(tokenHash);

	if (!session) {
		set.status = 401;
		throw new Error("Session not found");
	}

	// Check if session is expired
	if (new Date(session.expires_at) <= new Date()) {
		// Clean up expired session
		await authDb.sessions.delete(session.id);
		set.status = 401;
		throw new Error("Session expired");
	}

	return { userId: payload.sub, sessionId: session.id };
}

export async function optionalAuth({ jwt, headers }: any) {
	const token = headers.authorization?.replace("Bearer ", "");
	if (!token) return { userId: null };

	try {
		const payload = await jwt.verify(token);
		if (!payload) return { userId: null };

		// Hash token to find session
		const hasher = new Bun.CryptoHasher("sha256");
		hasher.update(token);
		const tokenHash = hasher.digest("hex");

		const session = await authDb.sessions.findByTokenHash(tokenHash);

		if (!session || new Date(session.expires_at) <= new Date()) {
			return { userId: null };
		}

		return { userId: payload.sub, sessionId: session.id };
	} catch {
		return { userId: null };
	}
}

