export interface ServiceStores {
	init(): Promise<void>;
	ensureCurrentScopeReady?(): Promise<void>;
}

export abstract class BaseService<TStores extends ServiceStores> {
	protected stores!: TStores;
	private readonly initPromise: Promise<void>;

	constructor(protected readonly msId: string) {
		this.initPromise = this.init();
	}

	protected abstract createStores(msId: string): TStores;

	private async init(): Promise<void> {
		this.stores = this.createStores(this.msId);
		await this.stores.init();
		await this.onInit();
	}

	protected async onInit(): Promise<void> {}

	protected async ready(): Promise<void> {
		await this.initPromise;
		await this.stores.ensureCurrentScopeReady?.();
	}
}
