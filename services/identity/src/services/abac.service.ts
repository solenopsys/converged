// src/services/abac.service.ts
import { policies, userAttributes } from "../db";

export class ABACService {
	async checkAccess(userId: string, resource: string, action: string) {
		// Get user attributes
		const userAttrs = await userAttributes
			.findByUser(userId)
			.executeTakeFirst();

		const context = {
			user: {
				id: userId,
				...(userAttrs ? JSON.parse(userAttrs.attributes) : {}),
			},
			resource,
			action,
		};

		// Get policies sorted by priority
		const allPolicies = await policies.list().execute();

		// Evaluate policies
		for (const policy of allPolicies) {
			const rules = JSON.parse(policy.rules);
			if (this.evaluatePolicy(rules, context)) {
				return { allowed: policy.effect === "ALLOW" };
			}
		}

		return { allowed: false };
	}

	private evaluatePolicy(rules: any, context: any): boolean {
		for (const [path, expectedValue] of Object.entries(rules)) {
			const actualValue = this.getValueByPath(context, path);

			if (Array.isArray(expectedValue)) {
				if (!expectedValue.includes(actualValue)) return false;
			} else if (actualValue !== expectedValue) {
				return false;
			}
		}

		return true;
	}

	private getValueByPath(obj: any, path: string) {
		return path.split(".").reduce((o, p) => o?.[p], obj);
	}
}

export const abacService = new ABACService();
