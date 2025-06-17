import { type INode } from "../core/types";

import { processTemplate } from "../tools/templator";
import { type ContextAccessor } from "../core/types";

export interface TemplateNodeConfig {
	templatePath: string; // JSONPath к шаблону
	mapping: Record<string, string>; // { placeholder: jsonPath }
}

export class TemplateInjectorNode implements INode {
	public name: string;
	private config: TemplateNodeConfig;

	constructor(name: string, config: TemplateNodeConfig) {
		this.name = name;
		this.config = config;
	}

	async execute(data: any, accessor: ContextAccessor): Promise<any> {
		const template = await accessor.getFrom(data, this.config.templatePath);

		if (!template) {
			throw new Error(
				`No template found at JSON path: ${this.config.templatePath}`,
			);
		}

		try {
			const params: any = {};

			for (const [placeholder, jsonPath] of Object.entries(
				this.config.mapping,
			)) {
				const value = await accessor.getFrom(data, jsonPath);
				params[placeholder] = value;
			}
			const result = processTemplate(template, data, params);
			return result;
		} catch (error: any) {
			throw new Error(`Error processing template: ${error.message}`);
		}
	}
}
