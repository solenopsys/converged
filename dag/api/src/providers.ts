import { PostgresProvider } from "./provider/pg-provider";
import { config } from 'dotenv';
import { Store } from "../persistent/kvs/store";
import { LevelDBStore } from "../persistent/kvs/store";

// Инициализируем dotenv перед использованием переменных окружения
config();

export async function initializeStore() {
	console.log("INIT LEVELDB");
	const store = Store.getInstance(new LevelDBStore(process.env.LEVEL_DB_PATH));
	await store.init();
	return store;
}

class Providers {
	private static instance: Providers;
	private static isInitialized = false;

	public readonly salesProvider: PostgresProvider;
	public readonly emailsProvider: PostgresProvider;
	public readonly openaiProvider: OpenAiProvider;
	public store!: Store;

	private constructor() {
		// Проверяем наличие необходимых переменных окружения
		if (!process.env.DATABASE_URL) {
			throw new Error('DATABASE_URL environment variable is required');
		}
		if (!process.env.OPENAI_API_KEY) {
			throw new Error('OPENAI_API_KEY environment variable is required');
		}
		if (!process.env.OPENAI_MODEL) {
			throw new Error('OPENAI_MODEL environment variable is required');
		}

		this.salesProvider = new PostgresProvider(process.env.DATABASE_URL + "/sales");
		this.emailsProvider = new PostgresProvider(process.env.DATABASE_URL + "/emails");
		this.openaiProvider = new OpenAiProvider(process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL);
	}

	public static getInstance(): Providers {
		if (!Providers.instance) {
			Providers.instance = new Providers();
		}
		return Providers.instance;
	}

	public static async getInitializedInstance(): Promise<Providers> {
		const instance = Providers.getInstance();
		if (!Providers.isInitialized) {
			await instance.init();
			Providers.isInitialized = true;
		}
		return instance;
	}

	private async init() {
		await this.salesProvider.init();
		await this.emailsProvider.init();
		this.store = await initializeStore();
	}

	async deinit() {
		await this.salesProvider.deinit();
		await this.emailsProvider.deinit();
		Providers.isInitialized = false;
	}
}

// Экспортируем функцию для получения инициализированного экземпляра
export const getProviders = () => Providers.getInitializedInstance();

// Для обратной совместимости можно также экспортировать инициализированный экземпляр
export default await Providers.getInitializedInstance();