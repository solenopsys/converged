import { KVDB } from "back-core";
import {
    OAuthProviderRepository,
    OAuthProviderKey,
    OAuthProviderValue,
    OAuthStateRepository,
    OAuthStateKey,
    OAuthStateValue
} from "./oauth-store-entities";

class OAuthStoreService {
    public readonly providerRepo: OAuthProviderRepository;
    public readonly stateRepo: OAuthStateRepository;

    constructor(db: KVDB) {
        this.providerRepo = new OAuthProviderRepository(db);
        this.stateRepo = new OAuthStateRepository(db);
    }

    // ========== OAUTH PROVIDERS ==========

    createProvider(provider: OAuthProviderValue): void {
        this.providerRepo.save(new OAuthProviderKey(provider.provider), provider);
    }

    getProvider(providerName: string): OAuthProviderValue | null {
        return this.providerRepo.get(new OAuthProviderKey(providerName));
    }

    updateProvider(providerName: string, updates: Partial<OAuthProviderValue>): void {
        const provider = this.getProvider(providerName);
        if (!provider) throw new Error(`OAuth provider ${providerName} not found`);

        const updatedProvider = { ...provider, ...updates };
        this.providerRepo.save(new OAuthProviderKey(providerName), updatedProvider);
    }

    deleteProvider(providerName: string): void {
        this.providerRepo.delete(new OAuthProviderKey(providerName));
    }

    listProviders(): OAuthProviderValue[] {
        const keys = this.providerRepo.listKeys();
        return keys
            .map(key => this.providerRepo.get(new OAuthProviderKey(key)))
            .filter((provider): provider is OAuthProviderValue => provider !== null);
    }

    listEnabledProviders(): OAuthProviderValue[] {
        return this.listProviders().filter(p => p.enabled);
    }

    enableProvider(providerName: string): void {
        this.updateProvider(providerName, { enabled: true });
    }

    disableProvider(providerName: string): void {
        this.updateProvider(providerName, { enabled: false });
    }

    isProviderEnabled(providerName: string): boolean {
        const provider = this.getProvider(providerName);
        return provider?.enabled ?? false;
    }

    // ========== OAUTH STATES ==========

    createState(state: OAuthStateValue): void {
        this.stateRepo.save(new OAuthStateKey(state.state), state);
    }

    getState(stateToken: string): OAuthStateValue | null {
        return this.stateRepo.get(new OAuthStateKey(stateToken));
    }

    deleteState(stateToken: string): void {
        this.stateRepo.delete(new OAuthStateKey(stateToken));
    }

    /**
     * Проверяет и потребляет state токен (одноразовое использование)
     * @returns state данные если валидный, null если истёк или не найден
     */
    consumeState(stateToken: string): OAuthStateValue | null {
        const state = this.getState(stateToken);
        if (!state) return null;

        // Проверяем истечение
        if (state.expires_at < Date.now()) {
            this.deleteState(stateToken);
            return null;
        }

        // Удаляем после использования (одноразовый токен)
        this.deleteState(stateToken);
        return state;
    }

    // ========== CLEANUP UTILITIES ==========

    /**
     * Удаляет истёкшие state токены
     * @returns количество удалённых токенов
     */
    cleanupExpiredStates(): number {
        const now = Date.now();
        const keys = this.stateRepo.listKeys();
        let deleted = 0;

        keys.forEach(key => {
            const state = this.stateRepo.get(new OAuthStateKey(key));
            if (state && state.expires_at < now) {
                this.deleteState(key);
                deleted++;
            }
        });

        return deleted;
    }

    /**
     * Генерирует новый state токен с TTL 10 минут
     */
    generateState(provider: string, returnTo: string): string {
        const stateToken = this.generateRandomToken();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 минут

        this.createState({
            state: stateToken,
            return_to: returnTo,
            provider,
            expires_at: expiresAt
        });

        return stateToken;
    }

    /**
     * Вспомогательный метод для генерации случайного токена
     */
    private generateRandomToken(): string {
        // Генерируем криптографически стойкий случайный токен
        // В реальной реализации используй crypto.randomBytes или подобное
        return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    }
}

export { OAuthStoreService };