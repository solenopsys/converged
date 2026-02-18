import { KVStore } from "back-core";
import { OAuthStateRepository, OAuthStateKey, OAuthStateValue } from "./entities";
import type { OAuthProviderName } from "../../types";
import { randomUUID } from "crypto";

const DEFAULT_STATE_TTL_SECONDS = 10 * 60;

export class OAuthStatesStoreService {
  private readonly stateRepo: OAuthStateRepository;

  constructor(private store: KVStore) {
    this.stateRepo = new OAuthStateRepository(store);
  }

  createState(state: OAuthStateValue): void {
    this.stateRepo.save(new OAuthStateKey(state.state), state);
  }

  getState(stateToken: string): OAuthStateValue | null {
    return this.stateRepo.get(new OAuthStateKey(stateToken)) ?? null;
  }

  deleteState(stateToken: string): void {
    this.stateRepo.delete(new OAuthStateKey(stateToken));
  }

  consumeState(stateToken: string): OAuthStateValue | null {
    const state = this.getState(stateToken);
    if (!state) {
      return null;
    }
    if (state.expiresAt < Date.now()) {
      this.deleteState(stateToken);
      return null;
    }
    this.deleteState(stateToken);
    return state;
  }

  cleanupExpiredStates(): number {
    const now = Date.now();
    const keys = this.stateRepo.listKeys();
    let deleted = 0;

    keys.forEach((key) => {
      const state = this.stateRepo.getDirect(key);
      if (state && state.expiresAt < now) {
        this.deleteState(state.state);
        deleted += 1;
      }
    });

    return deleted;
  }

  generateState(
    provider: OAuthProviderName,
    returnTo: string,
    ttlSeconds: number = DEFAULT_STATE_TTL_SECONDS,
  ): string {
    const stateToken = randomUUID();
    const expiresAt = Date.now() + ttlSeconds * 1000;

    this.createState({
      state: stateToken,
      returnTo,
      provider,
      expiresAt,
    });

    return stateToken;
  }
}
