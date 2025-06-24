// src/controllers/abac.controller.ts
import { abacService } from "../services/abac.service";

export const abacController = {
	async checkAccess({ body, userId }: any) {
		const result = await abacService.checkAccess(
			userId,
			body.resource,
			body.action,
		);
		return result;
	},
};
