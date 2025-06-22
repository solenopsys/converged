// src/services/auth.service.ts
import { users, authMethods, sessions } from "../db";
import bcrypt from "bcryptjs";

export class AuthService {
	async register(email: string, password: string, name?: string) {
		// Check if user exists
		const existing = await users.findByEmail(email).executeTakeFirst();

		if (existing) throw new Error("User already exists");

		// Create user
		const userId = crypto.randomUUID();
		await users
			.create({
				id: userId,
				email,
				name: name || null,
			})
			.execute();

		// Create password auth method
		const hashedPassword = await bcrypt.hash(password, 10);
		await authMethods
			.create({
				user_id: userId,
				type: "password",
				identifier: email,
				credential: hashedPassword,
			})
			.execute();

		return { id: userId, email, name };
	}

	async login(email: string, password: string) {
		const user = await users.findByEmail(email).executeTakeFirst();

		if (!user) throw new Error("Invalid credentials");

		const authMethod = await authMethods
			.findByIdentifier("password", email)
			.executeTakeFirst();

		if (!authMethod || !authMethod.credential) {
			throw new Error("Invalid credentials");
		}

		const valid = await bcrypt.compare(password, authMethod.credential);
		if (!valid) throw new Error("Invalid credentials");

		return this.createSession(user.id);
	}

	async createSession(userId: string) {
		const sessionId = crypto.randomUUID();

		// Create JWT token
		const token = await Bun.sign(
			{
				sub: userId,
				sid: sessionId,
				exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
			},
			process.env.JWT_SECRET || "secret",
		);

		// Hash token for storage
		const hasher = new Bun.CryptoHasher("sha256");
		hasher.update(token);
		const tokenHash = hasher.digest("hex");

		// Store session
		await sessions
			.create({
				id: sessionId,
				user_id: userId,
				token_hash: tokenHash,
				expires_at: new Date(
					Date.now() + 7 * 24 * 60 * 60 * 1000,
				).toISOString(),
			})
			.execute();

		return { token, userId };
	}

	async logout(tokenHash: string) {
		const session = await sessions
			.findByTokenHash(tokenHash)
			.executeTakeFirst();

		if (session) {
			await sessions.delete(session.id).execute();
		}
	}

	async validateSession(tokenHash: string) {
		const session = await sessions
			.findByTokenHash(tokenHash)
			.executeTakeFirst();

		if (!session) return null;

		// Check if expired
		if (new Date(session.expires_at) < new Date()) {
			await sessions.delete(session.id).execute();
			return null;
		}

		return session;
	}

	async cleanupExpiredSessions() {
		await sessions.deleteExpired().execute();
	}
}

export const authService = new AuthService();
