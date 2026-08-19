import type { PermissionEntry } from "nrpc";

export type JwtPayload = {
	sub?: string;
	exp?: number;
	iat?: number;
	perm?: string[];
	[key: string]: unknown;
};

export type TokenSet = {
	accessToken: string;
	refreshToken?: string;
	expiresAt?: number;
};

type Awaitable<T> = T | Promise<T>;

export interface TokenStorage {
	read(): Awaitable<TokenSet | null>;
	write(tokens: TokenSet): Awaitable<void>;
	clear(): Awaitable<void>;
}

export type AuthSessionKind = "guest" | "account" | "unknown";
export type AuthStatus = "idle" | "resolving" | "active" | "failed";
export type AuthErrorCode =
	| "invalid_token"
	| "expired_token"
	| "refresh_failed"
	| "guest_session_failed"
	| "authentication_cancelled";

export class AuthError extends Error {
	constructor(
		readonly code: AuthErrorCode,
		message: string,
		readonly cause?: unknown,
	) {
		super(message);
		this.name = "AuthError";
	}
}

export type AuthSnapshot = {
	status: AuthStatus;
	session: AuthSessionKind;
	tokens: TokenSet | null;
	claims: JwtPayload | null;
	error: AuthError | null;
};

export type GuestSessionReason = "missing" | "expired" | "refresh_failed";

export interface AuthFlow {
	refresh?(current: TokenSet): Promise<TokenSet | null>;
	createGuest?(reason: GuestSessionReason): Promise<TokenSet | null>;
	authenticate?(): Promise<TokenSet | null>;
	revoke?(current: TokenSet | null): Promise<void>;
	classify?(claims: JwtPayload): AuthSessionKind;
}

export type AuthControllerOptions = {
	storage: TokenStorage;
	flow: AuthFlow;
	leewaySeconds?: number;
	now?: () => number;
};

export type CapabilityRequirement = string | PermissionEntry;

export interface AuthController {
	snapshot(): AuthSnapshot;
	subscribe(listener: (snapshot: AuthSnapshot) => void): () => void;
	ensureSession(): Promise<AuthSnapshot>;
	authenticate(): Promise<AuthSnapshot>;
	setTokens(tokens: TokenSet | null): Promise<AuthSnapshot>;
	logout(): Promise<AuthSnapshot>;
	getAccessToken(): Promise<string | null>;
	can(requirement: CapabilityRequirement): boolean;
}
