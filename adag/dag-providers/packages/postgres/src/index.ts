import { Client } from "pg";
import  { type Provider, ProviderState } from "dag-api";



interface QueryParams {
	sql: string;
	params: any[];
  }
  
  export default class PostgresProvider implements Provider {
	
	private _state: ProviderState = ProviderState.STOPPED;
	private client!: Client;
	private connection!: string;

	constructor(private name:string, connection: string ) {
		this._state = ProviderState.STARTING;
	  this.connection = connection;
	  this.client = new Client({ connectionString: this.connection });
	  console.log("PostgresProvider initialized", this.connection);
	}
  
	get state(): ProviderState {
	  return this._state;
	}
  
	 
  
	async start(): Promise<void> {
	  this._state = ProviderState.STARTING;
	  
	  // @ts-ignore
	  if (this.client._connected) {
		this._state = ProviderState.READY;
		return;
	  }
  
	  try {
		await this.client.connect();
		console.log(`[${this.name}] Connected to PostgreSQL`);
		this._state = ProviderState.READY;
	  } catch (error: any) {
		console.error(`[${this.name}] Connection failed:`, error.message);
		this._state = ProviderState.ERROR;
		throw new Error(`Failed to connect to PostgreSQL: ${error.message}`);
	  }
	}
  
	async stop(): Promise<void> {
	  this._state = ProviderState.STOPPING;
	  
	  try {
		await this.client.end();
		console.log(`[${this.name}] Disconnected from PostgreSQL`);
		this._state = ProviderState.STOPPED;
	  } catch (error: any) {
		console.error(`[${this.name}] Disconnect error:`, error.message);
		this._state = ProviderState.ERROR;
		throw new Error(`Failed to disconnect from PostgreSQL: ${error.message}`);
	  }
	}
  
	isReady(): boolean {
	  return this._state === ProviderState.READY;
	}
  
	async invoke(operation: string, params: QueryParams): Promise<any[]> {
	  if (!this.isReady()) {
		throw new Error(`Provider is not ready (state: ${this._state})`);
	  }
  
	  if (operation === 'query') {
		return await this.query(params.sql, params.params);
	  }
	  
	  throw new Error(`Unknown operation: ${operation}`);
	}
  
	async query<T>(sql: string, params: any[]): Promise<T[]> {
	  if (!this.isReady()) {
		throw new Error(`Provider is not ready (state: ${this._state})`);
	  }
  
	  try {
		const result = await this.client.query(sql, params);
		return result.rows as T[];
	  } catch (error: any) {
		console.error(`[${this.name}] Query failed:`, error.message);
		this._state = ProviderState.ERROR;
		throw new Error(`Database query failed: ${error.message}`);
	  }
	}
  }