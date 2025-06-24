import { getDefaultAccessDatabaseService } from "../db";

export interface PolicyData {
	name: string;
	rules: Record<string, any>;
	effect: "ALLOW" | "DENY";
	priority?: number;
	description?: string;
}

export interface AccessContext {
	user: {
		id: string;
		[key: string]: any; // Дополнительные атрибуты пользователя при необходимости
	};
	resource: string;
	action: string;
	[key: string]: any; // Дополнительный контекст (время, IP и т.д.)
}

export interface AccessResult {
	allowed: boolean;
	matchedPolicy?: {
		id: string;
		name: string;
		effect: string;
	};
	reason?: string;
}

export class ABACService {
	private get db() {
		return getDefaultAccessDatabaseService();
	}

	async checkAccess(
		userId: string, 
		resource: string, 
		action: string,
		additionalContext: Record<string, any> = {}
	): Promise<AccessResult> {
		const context: AccessContext = {
			user: {
				id: userId,
				...additionalContext.user,
			},
			resource,
			action,
			...additionalContext,
		};

		try {
			// Get policies sorted by priority using the new service
			const allPolicies = await this.db.policies.list();

			if (allPolicies.length === 0) {
				return { 
					allowed: false, 
					reason: "No policies found" 
				};
			}

			// Evaluate policies in priority order
			for (const policy of allPolicies) {
				try {
					const rules = JSON.parse(policy.rules);
					if (this.evaluatePolicy(rules, context)) {
						const allowed = policy.effect === "ALLOW";
						return {
							allowed,
							matchedPolicy: {
								id: policy.id,
								name: policy.name,
								effect: policy.effect,
							},
							reason: allowed ? "Access granted by policy" : "Access denied by policy"
						};
					}
				} catch (error) {
					console.error(`Error evaluating policy ${policy.name}:`, error);
					// Продолжаем с следующей политикой
					continue;
				}
			}

			return { 
				allowed: false, 
				reason: "No matching policy found - default deny" 
			};
		} catch (error) {
			console.error("Error in checkAccess:", error);
			return { 
				allowed: false, 
				reason: "System error during access check" 
			};
		}
	}

	private evaluatePolicy(rules: Record<string, any>, context: AccessContext): boolean {
		// Если правил нет, политика не применяется
		if (!rules || typeof rules !== 'object') {
			return false;
		}

		for (const [path, expectedValue] of Object.entries(rules)) {
			const actualValue = this.getValueByPath(context, path);

			// Обработка различных типов сравнения
			if (!this.compareValues(actualValue, expectedValue)) {
				return false;
			}
		}

		return true;
	}

	private compareValues(actualValue: any, expectedValue: any): boolean {
		// Если ожидаемое значение - массив, проверяем включение
		if (Array.isArray(expectedValue)) {
			return expectedValue.includes(actualValue);
		}

		// Если ожидаемое значение - объект с операторами
		if (typeof expectedValue === 'object' && expectedValue !== null) {
			// Поддержка операторов типа { "$in": [...], "$eq": ..., "$ne": ... }
			if (expectedValue.$in && Array.isArray(expectedValue.$in)) {
				return expectedValue.$in.includes(actualValue);
			}
			if (expectedValue.$eq !== undefined) {
				return actualValue === expectedValue.$eq;
			}
			if (expectedValue.$ne !== undefined) {
				return actualValue !== expectedValue.$ne;
			}
			if (expectedValue.$gt !== undefined) {
				return actualValue > expectedValue.$gt;
			}
			if (expectedValue.$gte !== undefined) {
				return actualValue >= expectedValue.$gte;
			}
			if (expectedValue.$lt !== undefined) {
				return actualValue < expectedValue.$lt;
			}
			if (expectedValue.$lte !== undefined) {
				return actualValue <= expectedValue.$lte;
			}
		}

		// Простое сравнение на равенство
		return actualValue === expectedValue;
	}

	private getValueByPath(obj: any, path: string): any {
		if (!path || typeof path !== 'string') {
			return undefined;
		}
		
		return path.split(".").reduce((current, key) => {
			return current?.[key];
		}, obj);
	}

	// Дополнительные методы для работы с политиками
	async createPolicy(policyData: PolicyData) {
		try {
			// Валидация данных
			if (!policyData.name || !policyData.rules || !policyData.effect) {
				throw new Error("Missing required fields: name, rules, effect");
			}

			if (!["ALLOW", "DENY"].includes(policyData.effect)) {
				throw new Error("Effect must be either ALLOW or DENY");
			}

			const newPolicy = {
				...policyData,
				rules: JSON.stringify(policyData.rules),
				priority: policyData.priority ?? 0,
			};

			return await this.db.policies.create(newPolicy);
		} catch (error) {
			console.error("Error creating policy:", error);
			throw error;
		}
	}

	async updatePolicy(id: string, policyData: Partial<PolicyData>) {
		try {
			if (policyData.effect && !["ALLOW", "DENY"].includes(policyData.effect)) {
				throw new Error("Effect must be either ALLOW or DENY");
			}

			const updateData = {
				...policyData,
				...(policyData.rules && { rules: JSON.stringify(policyData.rules) }),
			};

			return await this.db.policies.update(id, updateData);
		} catch (error) {
			console.error("Error updating policy:", error);
			throw error;
		}
	}

	async deletePolicy(id: string) {
		try {
			return await this.db.policies.delete(id);
		} catch (error) {
			console.error("Error deleting policy:", error);
			throw error;
		}
	}

	async getPolicyById(id: string) {
		try {
			const policy = await this.db.policies.findById(id);
			if (policy) {
				return {
					...policy,
					rules: JSON.parse(policy.rules),
				};
			}
			return null;
		} catch (error) {
			console.error("Error getting policy by id:", error);
			throw error;
		}
	}

	async getPolicyByName(name: string) {
		try {
			const policy = await this.db.policies.findByName(name);
			if (policy) {
				return {
					...policy,
					rules: JSON.parse(policy.rules),
				};
			}
			return null;
		} catch (error) {
			console.error("Error getting policy by name:", error);
			throw error;
		}
	}

	async getAllPolicies() {
		try {
			const policies = await this.db.policies.list();
			return policies.map(policy => ({
				...policy,
				rules: JSON.parse(policy.rules),
			}));
		} catch (error) {
			console.error("Error getting all policies:", error);
			throw error;
		}
	}

	// Метод для тестирования политик
	async testPolicy(policyId: string, context: AccessContext): Promise<boolean> {
		try {
			const policy = await this.getPolicyById(policyId);
			if (!policy) {
				throw new Error("Policy not found");
			}

			return this.evaluatePolicy(policy.rules, context);
		} catch (error) {
			console.error("Error testing policy:", error);
			throw error;
		}
	}
}

export const abacService = new ABACService();