// src/config/oauth.config.ts
export const oauthConfig = {
	google: {
		clientId: process.env.GOOGLE_CLIENT_ID!,
		clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
		tokenUrl: "https://oauth2.googleapis.com/token",
		userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
		scopes: ["openid", "email", "profile"],
	},
};
