
// src/services/auth.service.ts
import { getDefaultAuthDatabaseService } from "../../../users/db";
import bcrypt from "bcryptjs";

export class AuthService {
	private get authDb() {
		return getDefaultAuthDatabaseService();
	}

	async register(email: string, password: string, name?: string) {
		// Check if user exists
		const existing = await this.authDb.kysely
			.selectFrom("users")
			.selectAll()
			.where("email", "=", email)
			.executeTakeFirst();

		if (existing) throw new Error("User already exists");

		// Create user and auth method in transaction
		return await this.authDb.transaction(async (trx) => {
			const userId = crypto.randomUUID();
			
			// Create user
			await trx
				.insertInto("users")
				.values({
					id: userId,
					email,
					name: name || null,
				})
				.execute();

			// Create password auth method
			const hashedPassword = await bcrypt.hash(password, 10);
			await this.authDb.authMethods.create({
				user_id: userId,
				type: "password",
				identifier: email,
				credential: hashedPassword,
			});

			return { id: userId, email, name };
		});
	}

	async login(email: string, password: string) {
		const user = await this.authDb.kysely
			.selectFrom("users")
			.selectAll()
			.where("email", "=", email)
			.executeTakeFirst();

		if (!user) throw new Error("Invalid credentials");

		const authMethod = await this.authDb.authMethods.findByIdentifier("password", email);

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
		await this.authDb.sessions.create({
			id: sessionId,
			user_id: userId,
			token_hash: tokenHash,
			expires_at: new Date(
				Date.now() + 7 * 24 * 60 * 60 * 1000,
			).toISOString(),
		});

		return { token, userId };
	}

	async logout(tokenHash: string) {
		const session = await this.authDb.sessions.findByTokenHash(tokenHash);

		if (session) {
			await this.authDb.sessions.delete(session.id);
		}
	}

	async validateSession(tokenHash: string) {
		const session = await this.authDb.sessions.findByTokenHash(tokenHash);

		if (!session) return null;

		// Check if expired
		if (new Date(session.expires_at) < new Date()) {
			await this.authDb.sessions.delete(session.id);
			return null;
		}

		return session;
	}

	async cleanupExpiredSessions() {
		await this.authDb.sessions.deleteExpired();
	}
}

export const authService = new AuthService();
