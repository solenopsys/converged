// src/controllers/oauth.controller.ts
import { oauthService } from "../services/oauth.service";

export const oauthController = {
	redirect({ params }: any) {
		const url = oauthService.getAuthUrl(params.provider);
		return Response.redirect(url);
	},

	async callback({ params, query }: any) {
		const result = await oauthService.handleCallback(
			params.provider,
			query.code,
		);
		return result;
	},
};
