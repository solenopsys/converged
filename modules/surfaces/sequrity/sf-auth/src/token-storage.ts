import type { TokenSet, TokenStorage } from "auth-controller";

export const AUTH_TOKEN_KEY = "authToken";

type StoredToken = {
	release: string;
	accessToken: string;
};

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The production import map appends the content hash as `?v=<buildId>`. */
export function authReleaseHash(moduleUrl: string): string {
	try {
		const release = new URL(moduleUrl).searchParams.get("v")?.trim();
		if (release) return release;
	} catch {
		// Development module URLs do not necessarily contain a query string.
	}
	return "development";
}

/**
 * Local development projects commonly share an origin but not an access-key
 * set. Include the mounted workspace so a token from another project is not
 * offered to its Fujin instance.
 */
export function authStorageRelease(moduleUrl: string, scope: string): string {
	const normalizedScope = scope.trim();
	return normalizedScope
		? `${authReleaseHash(moduleUrl)}:${normalizedScope}`
		: authReleaseHash(moduleUrl);
}

export function createBrowserTokenStorage(
	storage: KeyValueStorage,
	release: string,
): TokenStorage {
	return {
		read() {
			const raw = storage.getItem(AUTH_TOKEN_KEY)?.trim();
			if (!raw) return null;

			try {
				const value = JSON.parse(raw) as Partial<StoredToken>;
				if (
					value.release === release &&
					typeof value.accessToken === "string" &&
					value.accessToken.trim()
				) {
					return { accessToken: value.accessToken.trim() };
				}
			} catch {
				// Raw JWTs belong to the legacy, unversioned storage format.
			}

			storage.removeItem(AUTH_TOKEN_KEY);
			return null;
		},
		write(tokens: TokenSet) {
			const value: StoredToken = {
				release,
				accessToken: tokens.accessToken,
			};
			storage.setItem(AUTH_TOKEN_KEY, JSON.stringify(value));
		},
		clear() {
			storage.removeItem(AUTH_TOKEN_KEY);
		},
	};
}
