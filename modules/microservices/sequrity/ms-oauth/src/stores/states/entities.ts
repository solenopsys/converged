import { PrefixedRepositoryKV, SimpleKey } from "back-core";
import type { OAuthProviderName } from "../../types";

const OAUTH_STATE_PREFIX = "oauth_state";
class OAuthStateKey extends SimpleKey {
  readonly prefix = OAUTH_STATE_PREFIX;
}

export type OAuthStateValue = {
  state: string;
  returnTo: string;
  provider: OAuthProviderName;
  expiresAt: number;
};

class OAuthStateRepository extends PrefixedRepositoryKV<
  OAuthStateKey,
  OAuthStateValue
> {
  getPrefix(): string[] {
    return [OAUTH_STATE_PREFIX];
  }
}

export { OAUTH_STATE_PREFIX, OAuthStateKey, OAuthStateRepository };
