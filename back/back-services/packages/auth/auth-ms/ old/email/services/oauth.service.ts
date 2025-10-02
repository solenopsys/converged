// src/services/oauth.service.ts
import { getDefaultAuthDatabaseService } from   "../db";
import { oauthConfig } from "../config/oauth.config";
import { authService } from "./auth.service";

export class OAuthService {
	private get authDb() {
		return getDefaultAuthDatabaseService();
	}

	getAuthUrl(provider: string) {
		const config = oauthConfig[provider];
		if (!config) throw new Error("Unknown provider");

		const params = new URLSearchParams({
			client_id: config.clientId,
			redirect_uri: `${process.env.BASE_URL}/auth/oauth/${provider}/callback`,
			response_type: "code",
			scope: config.scopes.join(" "),
			state: crypto.randomUUID(),
		});

		return `${config.authUrl}?${params}`;
	}

	async handleCallback(provider: string, code: string) {
		const config = oauthConfig[provider];
		if (!config) throw new Error("Unknown provider");

		// Exchange code for tokens
		const tokenResponse = await fetch(config.tokenUrl, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
				client_id: config.clientId,
				client_secret: config.clientSecret,
				redirect_uri: `${process.env.BASE_URL}/auth/oauth/${provider}/callback`,
			}),
		});

		const tokens = await tokenResponse.json();

		// Get user info
		const userResponse = await fetch(config.userInfoUrl, {
			headers: { Authorization: `Bearer ${tokens.access_token}` },
		});

		const userInfo = await userResponse.json();

		// Find existing OAuth account
		const authMethod = await this.authDb.authMethods.findByIdentifier(provider, userInfo.id || userInfo.sub);

		if (authMethod) {
			// Update tokens for existing account
			await this.authDb.authMethods.update(authMethod.id, {
				credential: JSON.stringify(tokens)
			});

			return authService.createSession(authMethod.user_id);
		}

		// Check if user exists by email
		let user = await this.authDb.kysely
			.selectFrom("users")
			.selectAll()
			.where("email", "=", userInfo.email)
			.executeTakeFirst();

		if (!user) {
			// Create new user and OAuth method in transaction
			return await this.authDb.transaction(async (trx) => {
				const userId = crypto.randomUUID();
				
				// Create user
				await trx
					.insertInto("users")
					.values({
						id: userId,
						email: userInfo.email,
						name: userInfo.name || null,
					})
					.execute();

				// Link OAuth account to user
				await this.authDb.authMethods.create({
					user_id: userId,
					type: provider,
					identifier: userInfo.id || userInfo.sub,
					credential: JSON.stringify(tokens),
				});

				return authService.createSession(userId);
			});
		}

		// Link OAuth account to existing user
		await this.authDb.authMethods.create({
			user_id: user.id,
			type: provider,
			identifier: userInfo.id || userInfo.sub,
			credential: JSON.stringify(tokens),
		});

		return authService.createSession(user.id);
	}

	async unlinkAccount(userId: string, provider: string) {
		// Check that user has other auth methods
		const userAuthMethods = await this.authDb.authMethods.findByUser(userId);

		if (userAuthMethods.length <= 1) {
			throw new Error("Cannot unlink last authentication method");
		}

		// Remove OAuth method
		const oauthMethod = userAuthMethods.find((m) => m.type === provider);
		if (oauthMethod) {
			await this.authDb.authMethods.delete(oauthMethod.id);
		}
	}

	async refreshTokens(userId: string, provider: string) {
		const authMethod = await this.authDb.kysely
			.selectFrom("auth_methods")
			.selectAll()
			.where("user_id", "=", userId)
			.where("type", "=", provider)
			.executeTakeFirst();

		if (!authMethod || !authMethod.credential) {
			throw new Error("OAuth account not found");
		}

		const tokens = JSON.parse(authMethod.credential);
		const config = oauthConfig[provider];

		if (!tokens.refresh_token || !config) {
			throw new Error("Cannot refresh tokens");
		}

		// Refresh tokens
		const refreshResponse = await fetch(config.tokenUrl, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: tokens.refresh_token,
				client_id: config.clientId,
				client_secret: config.clientSecret,
			}),
		});

		const newTokens = await refreshResponse.json();

		// Update stored tokens
		await this.authDb.authMethods.update(authMethod.id, {
			credential: JSON.stringify(newTokens)
		});

		return newTokens;
	}
}

export const oauthService = new OAuthService();