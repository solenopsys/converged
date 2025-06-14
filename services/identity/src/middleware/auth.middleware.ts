// src/middleware/auth.middleware.ts
import { sessions } from "../db";

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

	const session = await sessions.findByTokenHash(tokenHash).executeTakeFirst();

	if (!session) {
		set.status = 401;
		throw new Error("Session not found");
	}

	// Check if session is expired
	if (new Date(session.expires_at) <= new Date()) {
		// Clean up expired session
		await sessions.delete(session.id).execute();
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

		const session = await sessions
			.findByTokenHash(tokenHash)
			.executeTakeFirst();

		if (!session || new Date(session.expires_at) <= new Date()) {
			return { userId: null };
		}

		return { userId: payload.sub, sessionId: session.id };
	} catch {
		return { userId: null };
	}
}

export async function requireRole(requiredRole: string) {
	return async function ({ userId, set }: any) {
		if (!userId) {
			set.status = 401;
			throw new Error("Unauthorized");
		}

		// Get user attributes to check role
		const { userAttributes } = await import("../db");
		const attrs = await userAttributes.findByUser(userId).executeTakeFirst();

		if (!attrs) {
			set.status = 403;
			throw new Error("Access denied");
		}

		const userAttrs = JSON.parse(attrs.attributes);
		if (userAttrs.role !== requiredRole) {
			set.status = 403;
			throw new Error("Insufficient permissions");
		}

		return { userId, role: userAttrs.role };
	};
}

export async function requirePermission(permission: string) {
	return async function ({ userId, set }: any) {
		if (!userId) {
			set.status = 401;
			throw new Error("Unauthorized");
		}

		// Use ABAC service to check permission
		const { abacService } = await import("../services/abac.service");
		const result = await abacService.checkAccess(userId, "api", permission);

		if (!result.allowed) {
			set.status = 403;
			throw new Error("Access denied");
		}

		return { userId, permission };
	};
}
