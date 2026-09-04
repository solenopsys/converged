import type { AccessService, AccessPreset, Permission } from "./types";
import { StoresController } from "./stores";
import { Access, getCurrentWorkspaceContext } from "nrpc";
import { UserJwtIssuer } from "./jwt";

const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

type PresetResolution = {
	presetName: string;
	exists: boolean;
	permissionsCount: number;
};

type PermissionResolutionDiagnostics = {
	userId: string;
	userAccessExists: boolean;
	directPermissionsCount: number;
	linkedPresets: string[];
	presetResolutions: PresetResolution[];
	reasons: string[];
};

type PermissionResolution = {
	permissions: Permission[];
	diagnostics: PermissionResolutionDiagnostics;
};

function resolveTtlSeconds(configTtl?: number): number {
	if (
		typeof configTtl === "number" &&
		Number.isFinite(configTtl) &&
		configTtl > 0
	) {
		return Math.floor(configTtl);
	}

	const rawEnvTtl = process.env.ACCESS_JWT_TTL;
	if (rawEnvTtl) {
		const parsedEnvTtl = Number(rawEnvTtl);
		if (Number.isFinite(parsedEnvTtl) && parsedEnvTtl > 0) {
			return Math.floor(parsedEnvTtl);
		}
	}

	return DEFAULT_TTL_SECONDS;
}
// Permission management and JWT issuance are cluster-internal operations.
// Auth calls these with SERVICE_TOKEN while issuing a browser session.
@Access("internal")
export class AccessServiceImpl implements AccessService {
	private stores: StoresController;
	private initPromise?: Promise<void>;
	private ttlSeconds: number;
	private userJwtIssuer?: UserJwtIssuer;

	constructor(config: { ttlSeconds?: number; accessJwtPrivateKey?: string; accessJwtKid?: string; accessJwtIssuer?: string; accessJwtAudience?: string } = {}) {
		const privateKey = config.accessJwtPrivateKey ?? process.env.ACCESS_JWT_PRIVATE_KEY;
		if (!privateKey) {
			throw new Error("ACCESS_JWT_PRIVATE_KEY is required for JWT signing");
		}
		this.ttlSeconds = resolveTtlSeconds(config.ttlSeconds);
		this.userJwtIssuer = new UserJwtIssuer({
			privateJwk: privateKey,
			kid: config.accessJwtKid ?? process.env.ACCESS_JWT_KID ?? "",
			issuer: config.accessJwtIssuer ?? process.env.ACCESS_JWT_ISSUER ?? "rp-access",
			audience: config.accessJwtAudience ?? process.env.ACCESS_JWT_AUDIENCE ?? "cluster",
		});
		this.init();
	}

	private async init() {
		if (this.initPromise) {
			return this.initPromise;
		}
		this.initPromise = (async () => {
			this.stores = new StoresController("rp-access");
			await this.stores.init();
		})();
		return this.initPromise;
	}

	private async ready(): Promise<void> {
		await this.init();
		await this.stores.ensureCurrentScopeReady();
		await this.stores.migrateLegacyPresetsForCurrentScope();
	}

	private buildEmptyPermissionsReasons(
		userAccessExists: boolean,
		directPermissionsCount: number,
		linkedPresets: string[],
		presetResolutions: PresetResolution[],
	): string[] {
		const reasons: string[] = [];
		if (!userAccessExists) reasons.push("user_access_not_found");
		if (directPermissionsCount === 0) reasons.push("no_direct_permissions");
		if (linkedPresets.length === 0) reasons.push("no_linked_presets");

		for (const preset of presetResolutions) {
			if (!preset.exists) {
				reasons.push(`preset_file_not_found:${preset.presetName}.json`);
			} else if (preset.permissionsCount === 0) {
				reasons.push(`preset_empty:${preset.presetName}`);
			}
		}
		return reasons;
	}

	private async resolvePermissions(
		userId: string,
	): Promise<PermissionResolution> {
		const existing = this.stores.access.findUserAccess(userId);
		const access = existing ?? { userId, presets: [], permissions: [] };
		const permissions = new Set(access.permissions);
		const presetResolutions: PresetResolution[] = [];

		for (const presetName of access.presets) {
			const preset = await this.stores.access.getPresetWithMeta(presetName);
			preset.permissions.forEach((perm) => permissions.add(perm));
			presetResolutions.push({
				presetName,
				exists: preset.exists,
				permissionsCount: preset.permissions.length,
			});
		}

		const result = [...permissions];
		const reasons =
			result.length === 0
				? this.buildEmptyPermissionsReasons(
						!!existing,
						access.permissions.length,
						[...access.presets],
						presetResolutions,
					)
				: [];

		return {
			permissions: result,
			diagnostics: {
				userId,
				userAccessExists: !!existing,
				directPermissionsCount: access.permissions.length,
				linkedPresets: [...access.presets],
				presetResolutions,
				reasons,
			},
		};
	}

	@Access("internal")
	async emitJWT(userId: string): Promise<string> {
		await this.ready();
		const resolved = await this.resolvePermissions(userId);
		const permissions = resolved.permissions;
		if (permissions.length === 0) {
			const missingPresetFiles = resolved.diagnostics.presetResolutions
				.filter((preset) => !preset.exists)
				.map((preset) => `${preset.presetName}.json`);
			console.warn(
				`[rp-access] emitJWT empty permissions: ${JSON.stringify({
					...resolved.diagnostics,
					permissions,
					missingPresetFiles,
					presetStoreType: "json",
				})}`,
			);
		} else {
			console.info(
				`[rp-access] emitJWT permissions resolved: ${JSON.stringify({
					userId,
					totalPermissions: permissions.length,
					directPermissionsCount: resolved.diagnostics.directPermissionsCount,
					linkedPresets: resolved.diagnostics.linkedPresets,
					presetResolutions: resolved.diagnostics.presetResolutions,
					ttlSeconds: this.ttlSeconds,
				})}`,
			);
		}
		return this.userJwtIssuer!.issue(userId, this.resolveJwtScope(), permissions, this.ttlSeconds);
	}

	@Access("internal")
	async issueServiceJWT(serviceName: string, permissions: Permission[]): Promise<string> {
		if (!/^[a-z0-9][a-z0-9._-]*$/i.test(serviceName)) {
			throw new Error("service JWT subject must be a process name");
		}
		if (!permissions.length) throw new Error("service JWT requires explicit permissions");
		return this.userJwtIssuer!.issueService(serviceName, permissions, this.ttlSeconds);
	}

	private resolveJwtScope(): string {
		const scope = getCurrentWorkspaceContext()?.scope ?? process.env.STORAGE_SCOPE ?? process.env.ACCESS_JWT_SCOPE ?? "";
		const normalized = scope.trim();
		if (!normalized) throw new Error("storage scope is required for user JWT signing");
		return normalized;
	}

	async addPermissionToUser(
		userId: string,
		permission: Permission,
	): Promise<void> {
		await this.ready();
		this.stores.access.addPermissionToUser(userId, permission);
	}

	async removePermissionFromUser(
		userId: string,
		permission: Permission,
	): Promise<void> {
		await this.ready();
		this.stores.access.removePermissionFromUser(userId, permission);
	}

	async getPermissionsFromUser(userId: string): Promise<Permission[]> {
		await this.ready();
		return this.stores.access.getPermissionsFromUser(userId);
	}

	async getPermissionsMixinFromUser(userId: string): Promise<Permission[]> {
		await this.ready();
		return (await this.resolvePermissions(userId)).permissions;
	}

	async linkPresetToUser(userId: string, presetName: string): Promise<void> {
		await this.ready();
		this.stores.access.linkPresetToUser(userId, presetName);
		console.info(
			`[rp-access] linkPresetToUser: ${JSON.stringify({ userId, presetName })}`,
		);
	}

	async unlinkPresetFromUser(
		userId: string,
		presetName: string,
	): Promise<void> {
		await this.ready();
		this.stores.access.unlinkPresetFromUser(userId, presetName);
		console.info(
			`[rp-access] unlinkPresetFromUser: ${JSON.stringify({ userId, presetName })}`,
		);
	}

	async createPreset(
		presetName: string,
		permissions: Permission[],
	): Promise<void> {
		await this.ready();
		await this.stores.access.createPreset(presetName, permissions);
	}

	async updatePreset(
		presetName: string,
		permissions: Permission[],
	): Promise<void> {
		await this.ready();
		await this.stores.access.updatePreset(presetName, permissions);
	}

	async deletePreset(presetName: string): Promise<void> {
		await this.ready();
		await this.stores.access.deletePreset(presetName);
	}

	async getPreset(presetName: string): Promise<Permission[] | null> {
		await this.ready();
		const permissions =
			await this.stores.access.getPermissionsFromPreset(presetName);
		return permissions.length > 0 ? permissions : null;
	}

	async getAllPresets(): Promise<AccessPreset[]> {
		await this.ready();
		const presets = await this.stores.access.getPresets();
		const items = await Promise.all(
			presets.map(async (name) => ({
				name,
				permissions: await this.stores.access.getPermissionsFromPreset(name),
			})),
		);
		return items;
	}
}

export default AccessServiceImpl;
