const MF_NAME = "mf-landing";
const DEFAULT_CONFIG_PATH = "ru/product/landing/4ir-laiding.json";
const DEFAULT_TITLE = "4ir";

export function getLandingConfigPath(): string {
  const globalEnv = ((globalThis as any).__MF_ENV__ ?? {}) as Record<string, unknown>;
  const mfEnv = (globalEnv[MF_NAME] ?? {}) as Record<string, unknown>;
  const value = mfEnv.landingConfId;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_CONFIG_PATH;
}

export function getLandingMenuTitle(): string {
  const globalEnv = ((globalThis as any).__MF_ENV__ ?? {}) as Record<string, unknown>;
  const mfEnv = (globalEnv[MF_NAME] ?? {}) as Record<string, unknown>;
  const value = mfEnv.title;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_TITLE;
}
