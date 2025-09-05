import { type INode } from "dag-api";
import { type Provider,getProvidersPool,evaluateJsonPathString } from "dag-api";
function normalize(v: unknown) {
	if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
	return v;
  }

export default class SQLQueryNode implements INode {
	public scope!: string;
   

	constructor(
		public name: string,
		private query: string,
		private provider: string,
	) {
	}


	  
	  async execute(data: unknown): Promise<any> {
		console.log("Executing SQL query:", this.query);
	  
		let sql = this.query;
		const paramValues: any[] = [];
	  
		const regex = /:(\w+)/g;
		let match;
		let paramIndex = 1;
	  
		while ((match = regex.exec(sql)) !== null) {
		  const name = match[1];
		  const raw = await evaluateJsonPathString(data, name);
		  const v = normalize(raw);
		  paramValues.push(v);
		  sql = sql.replace(`:${name}`, `$${paramIndex}`);
		  paramIndex++;
		}
	  
		console.log("Transformed SQL:", sql);
		console.log("Parameter values (typeof):", paramValues.map(v => [v, typeof v]));
	  
		const realProvider: Provider = await getProvidersPool().getOrCreate(this.provider);
	  
		// Диагностика окружения одним запросом
		try {
		  const env = await (realProvider as any).invoke?.("query", {
			sql: `select current_database() as db,
						 current_user as usr,
						 inet_server_port() as port,
						 current_setting('search_path') as search_path`,
			params: []
		  });
		  console.log("DB env:", env?.[0]);
		} catch (_) {}
	  
		const results = await realProvider.invoke("query", { sql, params: paramValues });
		console.log("RowCount:", Array.isArray(results) ? results.length : "(n/a)");
		return results;
	  }
}