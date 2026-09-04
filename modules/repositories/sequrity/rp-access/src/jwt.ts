import { importJWK, SignJWT, type JWK } from "jose";

export interface UserJwtIssuerConfig {
	privateJwk: string;
	kid: string;
	issuer: string;
	audience: string;
}

/** Ed25519 signer owned only by rp-access. */
export class UserJwtIssuer {
	private readonly signingKey: Promise<Awaited<ReturnType<typeof importJWK>>>;

	constructor(private readonly config: UserJwtIssuerConfig) {
		if (!config.kid.trim()) throw new Error("ACCESS_JWT_KID is required for EdDSA JWT signing");
		this.signingKey = importJWK(parsePrivateJwk(config.privateJwk), "EdDSA");
	}

	async issue(userId: string, scope: string, permissions: string[], ttlSeconds: number): Promise<string> {
		if (!scope.trim()) throw new Error("JWT scope is required for user JWT signing");
		return new SignJWT({ typ: "user", scope, perm: permissions })
			.setProtectedHeader({ alg: "EdDSA", kid: this.config.kid })
			.setSubject(userId)
			.setIssuer(this.config.issuer)
			.setAudience(this.config.audience)
			.setIssuedAt()
			.setExpirationTime(`${ttlSeconds}s`)
			.sign(await this.signingKey);
	}

	async issueService(serviceName: string, permissions: string[], ttlSeconds: number): Promise<string> {
		if (!serviceName.trim()) throw new Error("service name is required for service JWT signing");
		return new SignJWT({ typ: "service", perm: permissions })
			.setProtectedHeader({ alg: "EdDSA", kid: this.config.kid })
			.setSubject(serviceName)
			.setIssuer(this.config.issuer)
			.setAudience(this.config.audience)
			.setIssuedAt()
			.setExpirationTime(`${ttlSeconds}s`)
			.sign(await this.signingKey);
	}
}

function parsePrivateJwk(value: string): JWK {
	try {
		const parsed = JSON.parse(value) as JWK;
		if (parsed.kty !== "OKP" || parsed.crv !== "Ed25519" || typeof parsed.d !== "string") {
			throw new Error("expected an Ed25519 private JWK");
		}
		return parsed;
	} catch (cause) {
		const reason = cause instanceof Error ? cause.message : String(cause);
		throw new Error(`ACCESS_JWT_PRIVATE_KEY is invalid: ${reason}`);
	}
}
