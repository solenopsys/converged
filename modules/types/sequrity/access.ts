/**
 * One grant, named the way a human points at a single permission:
 * `kind/service/method(mode)`, e.g. `rp/files/save(w)`.
 *
 * Query syntax, not storage. It names the one grant an add or a remove is
 * about; a *set* of grants is a `GrantTree`.
 */
export type Permission = string;

/** The methods a service grants: a mode per group, or one mode for all of them. */
export type GrantMethods = string | { [mode: string]: string[] };

/**
 * A set of grants, stored and carried as `kind -> service -> mode -> methods`.
 *
 * Each level is named once, so a service granting thirteen write methods writes
 * the kind, the service and `w` once each instead of on every line:
 *
 * ```json
 * {
 *   "ap": { "resonus": { "w": ["session.open", "session.close"] } },
 *   "rp": { "files": { "r": ["get"], "w": ["save"] } },
 *   "wf": { "workflows": { "x": ["wf-file-analyze.js"] } }
 * }
 * ```
 *
 * `*` is a wildcard at any level, and a bare mode in place of the method map
 * covers every method — full access is `{ "*": { "*": "rwx" } }`.
 */
export type GrantTree = {
  [kind: string]: { [service: string]: GrantMethods };
};

export type AccessPreset = {
  name: string;
  permissions: GrantTree;
}

export interface AccessService {
  emitJWT(userId: string): Promise<string>;
  issueServiceJWT(serviceName: string, permissions: GrantTree): Promise<string>;

  addPermissionToUser(userId: string, permission: Permission): Promise<void>;
  removePermissionFromUser(userId: string, permission: Permission): Promise<void>;
  getPermissionsFromUser(userId: string): Promise<GrantTree>;
  getPermissionsMixinFromUser(userId: string): Promise<GrantTree>;

  linkPresetToUser(userId: string, presetName: string): Promise<void>;
  unlinkPresetFromUser(userId: string, presetName: string): Promise<void>;

  createPreset(presetName: string, permissions: GrantTree): Promise<void>;
  updatePreset(presetName: string, permissions: GrantTree): Promise<void>;
  deletePreset(presetName: string): Promise<void>;
  getPreset(presetName: string): Promise<GrantTree | null>;
  getAllPresets(): Promise<AccessPreset[]>;
}
