import { PrefixedRepositoryKV, SimpleKey } from "back-core";

// ========== 1. OAUTH PROVIDERS ==========
const OAUTH_PROVIDER_PREFIX = "oauth_provider";
class OAuthProviderKey extends SimpleKey {
    readonly prefix = OAUTH_PROVIDER_PREFIX;
}

type OAuthProviderValue = {
    provider: string;
    client_id: string;
    client_secret: string;
    authorize_url: string;
    token_url: string;
    userinfo_url: string;
    scopes: string[];
    enabled: boolean;
};

class OAuthProviderRepository extends PrefixedRepositoryKV<OAuthProviderKey, OAuthProviderValue> {
    getPrefix(): string[] {
        return [OAUTH_PROVIDER_PREFIX];
    }
}

export { OAUTH_PROVIDER_PREFIX, OAuthProviderKey, OAuthProviderRepository, type OAuthProviderValue };

// ========== 2. OAUTH STATES ==========
const OAUTH_STATE_PREFIX = "oauth_state";
class OAuthStateKey extends SimpleKey {
    readonly prefix = OAUTH_STATE_PREFIX;
}

type OAuthStateValue = {
    state: string;
    return_to: string;
    provider: string;
    expires_at: number;
};

class OAuthStateRepository extends PrefixedRepositoryKV<OAuthStateKey, OAuthStateValue> {
    getPrefix(): string[] {
        return [OAUTH_STATE_PREFIX];
    }
}

export { OAUTH_STATE_PREFIX, OAuthStateKey, OAuthStateRepository, type OAuthStateValue };