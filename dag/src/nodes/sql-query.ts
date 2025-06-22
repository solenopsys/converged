import { type INode } from "../core/types";
import { type DatabaseProvider } from "../core/types";
import { extractParams } from "../libs/templator";
import { Accessor } from "../libs/accessor";
 

export class SQLQueryNode implements INode {
	public scope!: string;

	constructor(
		public name: string,
		private query: string,
		private provider: string,
		private providers: Record<string, DatabaseProvider>,
	) {}

	async execute(data: unknown, context: Accessor): Promise<any> {
		let sql = this.query;
		const params = extractParams(sql);
		const paramValues: any[] = [];

		for (let i = 0; i < params.length; i++) {
			const p = params[i];
			const v = await context.getFrom(data, p);
			paramValues.push(v);

			const needle = `:${p}`;

			sql = sql.replaceAll(needle, `$${i + 1}`);
		}

		console.log("Transformed SQL:", sql);
		console.log("Parameter values:", paramValues);

		const realProvider: DatabaseProvider = this.providers[
			this.provider
		] as DatabaseProvider;
		const results = await realProvider.query(sql, paramValues);

		return results;
	}
}
