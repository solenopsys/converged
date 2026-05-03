export {
  WORKSPACE_HEADER,
  WORKSPACE_HEADER_ALT,
  WORKSPACE_DOMAIN_MAP_ENV,
  NRPC_WORKSPACE_DOMAIN_MAP_ENV,
  normalizeHost,
  parseWorkspaceDomainMap,
  resolveWorkspaceFromDomain,
  resolveWorkspaceFromHeaders,
  resolveWorkspaceFromRequest,
  buildWorkspaceHeaders,
  createWorkspaceBootstrapScript,
} from "back-core/workspace-domain";

export type {
  WorkspaceDomainMap,
  ResolveWorkspaceOptions,
} from "back-core/workspace-domain";
