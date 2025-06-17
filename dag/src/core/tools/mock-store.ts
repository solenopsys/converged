import type { StoreProvider } from "../types";

export class MockStoreProvider implements StoreProvider {
	private storage: Map<string, string> = new Map();
	private initialized: boolean = false;

	// For testing purposes - access to internal storage
	getStorage(): Map<string, string> {
		return new Map(this.storage);
	}

	// Clear all data - useful for test cleanup
	clear(): void {
		this.storage.clear();
	}

	async init(): Promise<void> {
		if (this.initialized) {
			throw new Error("MockStore already initialized");
		}
		this.initialized = true;
		// Simulate async initialization
		await new Promise((resolve) => setTimeout(resolve, 1));
	}

	async deinit(): Promise<void> {
		if (!this.initialized) {
			throw new Error("MockStore not initialized");
		}
		this.initialized = false;
		// Optionally clear storage on deinit
		this.storage.clear();
		// Simulate async deinitialization
		await new Promise((resolve) => setTimeout(resolve, 1));
	}

	async put(key: string, value: any): Promise<void> {
		if (!this.initialized) {
			throw new Error("MockStore not initialized");
		}
		// Store as JSON string
		this.storage.set(key, JSON.stringify(value));
		// Simulate async operation
		await new Promise((resolve) => setTimeout(resolve, 1));
	}

	async get(key: string): Promise<any> {
		if (!this.initialized) {
			throw new Error("MockStore not initialized");
		}
		const value = this.storage.get(key);
		if (value === undefined) {
			return null;
		}
		// Parse from JSON string
		return JSON.parse(value);
	}

	async delete(key: string): Promise<void> {
		if (!this.initialized) {
			throw new Error("MockStore not initialized");
		}
		this.storage.delete(key);
		// Simulate async operation
		await new Promise((resolve) => setTimeout(resolve, 1));
	}

	async exists(key: string): Promise<boolean> {
		if (!this.initialized) {
			throw new Error("MockStore not initialized");
		}
		return this.storage.has(key);
	}
}
