import { createBridgeController } from './controller';
import { prepareModulesFilterBootstrap } from './modules-filter';

function isLikelyJwt(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => part.trim().length > 0);
}

function applyAuthTokenFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const authToken =
      url.searchParams.get('auth_token') ??
      url.searchParams.get('access_token') ??
      url.searchParams.get('token');
    const hasOauthCallback =
      Boolean(url.searchParams.get('oauth_provider')) &&
      Boolean(url.searchParams.get('oauth_code'));

    if (authToken && isLikelyJwt(authToken)) {
      window.localStorage.setItem('authToken', authToken);
      window.sessionStorage.removeItem('tempUserId');
      window.sessionStorage.removeItem('tempSessionId');
      window.dispatchEvent(new Event('auth-token-changed'));
    }

    if (!authToken && !hasOauthCallback) return;

    [
      'oauth_provider',
      'oauth_code',
      'oauth_state',
      'auth_token',
      'token',
      'access_token',
    ].forEach((key) => url.searchParams.delete(key));

    window.history.replaceState(window.history.state, '', url.toString());
  } catch {
    // Keep bootstrap resilient: URL/storage parsing should not break app startup.
  }
}

async function bootstrap(): Promise<void> {
  applyAuthTokenFromUrl();
  await prepareModulesFilterBootstrap();

  const bridge = createBridgeController();
  const bridgeGlobal = globalThis as typeof globalThis & {
    __SSR_SPA_BRIDGE__?: ReturnType<typeof createBridgeController>;
  };
  bridgeGlobal.__SSR_SPA_BRIDGE__ = bridge;

  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('ssr-spa-bridge:ready'));
  }
}

void bootstrap();
