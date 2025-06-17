import { Level } from "level";
import { randomUUID } from "crypto";

import type { StoreProvider } from "./types";

export class LevelDBStore implements StoreProvider {
	private db: Level<string, any> | null = null;
	private dbPath: string;

	constructor(dbPath: string = "./workflow-data") {
		this.dbPath = dbPath;
	}

	async init(): Promise<void> {
		this.db = new Level(this.dbPath, { valueEncoding: "json" });
		await this.db.open();
	}

	async deinit(): Promise<void> {
		if (this.db) {
			await this.db.close();
			this.db = null;
		}
	}

	private getDb(): Level<string, any> {
		if (!this.db) throw new Error("Database not initialized");
		return this.db!;
	}

	async put(key: string, value: any): Promise<void> {
		console.log("PUT KEY: ", key);
		await this.getDb().put(key, value);
	}

	async get(key: string): Promise<any> {
		try {
			return await this.getDb().get(key);
		} catch (error: any) {
			if (error.code === "LEVEL_NOT_FOUND") {
				return null;
			}
			throw error;
		}
	}

	async delete(key: string): Promise<void> {
		await this.getDb().del(key);
	}

	async exists(key: string): Promise<boolean> {
		try {
			await this.getDb().get(key);
			return true;
		} catch (error: any) {
			if (error.code === "LEVEL_NOT_FOUND") {
				return false;
			}
			throw error;
		}
	}
}

interface StoreInterface {
	init(): Promise<void>;
	deinit(): Promise<void>;
	save(workflowId: string, nodeName: string, value: any): Promise<void>;
	get(workflowId: string, nodeName: string): Promise<any>;
}

export class Store implements StoreInterface {
	private provider: StoreProvider;

	// todo singleton
	private static instance: Store;

	private constructor(provider: StoreProvider) {
		this.provider = provider;
	}

	public static getInstance(provider?: StoreProvider): Store {
		if (!Store.instance) {
			Store.instance = new Store(provider ?? new LevelDBStore());
		}
		return Store.instance;
	}

	async init(): Promise<void> {
		await this.provider.init();
	}

	async deinit(): Promise<void> {
		await this.provider.deinit();
	}

	async save(workflowId: string, nodeName: string, value: any): Promise<void> {
		await this.provider.put(`${workflowId}:${nodeName}`, value);
	}

	async get(workflowId: string, nodeName: string): Promise<any> {
		return await this.provider.get(`${workflowId}:${nodeName}`);
	}
}
