import { OpenAiProvider } from "../provider/openai-provider";
import { PostgresProvider } from "../provider/pg-provider";
import { config } from 'dotenv';
import { Store } from "../core/store";
import { LevelDBStore } from "../core/store";

// Инициализируем dotenv перед использованием переменных окружения
config();

export async function initializeStore() {
	const store = Store.getInstance(new LevelDBStore(process.env.LEVEL_DB_PATH));
	await store.init();
	return store;
}

class Providers {
	public readonly salesProvider: PostgresProvider;
	public readonly emailsProvider: PostgresProvider;
	public readonly openaiProvider: OpenAiProvider;
	public store!: Store;

	constructor() {
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

	async init() {
		await this.salesProvider.init();
		await this.emailsProvider.init();
		this.store = await initializeStore();
	}

	async deinit() {
		await this.salesProvider.deinit();
		await this.emailsProvider.deinit();
	}
}

const providers = new Providers();

export default providers;