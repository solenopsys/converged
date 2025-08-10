import { Client } from "pg";
import { type DatabaseProvider } from "../types";

export class PostgresProvider implements DatabaseProvider {
	name = "postgres";
	private client: Client;

	constructor(private connection: string) {
		console.log("PostgresProvider constructor", connection);
		this.client = new Client({ connectionString: connection });
	}

	async init(): Promise<void> {
		// @ts-ignore
		if (this.client._connected) {
			return;
		}
		try {
			await this.client.connect();
			console.log(`[${this.name}] Connected to PostgreSQL`);
		} catch (error: any) {
			console.error(`[${this.name}] Connection failed:`, error.message);
			throw new Error(`Failed to connect to PostgreSQL: ${error.message}`);
		}
	}

	async deinit(): Promise<void> {
		try {
			await this.client.end();
			console.log(`[${this.name}] Disconnected from PostgreSQL`);
		} catch (error: any) {
			console.error(`[${this.name}] Disconnect error:`, error.message);
			throw new Error(`Failed to disconnect from PostgreSQL: ${error.message}`);
		}
	}

	async query<T>(sql: string, params: any[]): Promise<T[]> {
		try {
			const result = await this.client.query(sql, params);
			return result.rows as T[];
		} catch (error: any) {
			console.error(`[${this.name}] Query failed:`, error.message);
			throw new Error(`Database query failed: ${error.message}`);
		}
	}
}