import { useMemo } from "react";
import LandingView from "../../../../microfrontends/mf-landing/src/views/LandingView";

const DEFAULT_LANDING_CONF_ID = "ru/product/landing/4ir-laiding.json";

function resolveLandingConfigPath(): string {
  const landingMap = (globalThis as any).__LANDING_SSR_DATA__;
  if (landingMap && typeof landingMap === "object") {
    const keys = Object.keys(landingMap);
    if (keys.length > 0 && typeof keys[0] === "string" && keys[0].trim().length > 0) {
      return keys[0];
    }
  }

  const value = (globalThis as any).__MF_ENV__?.["mf-landing"]?.landingConfId;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_LANDING_CONF_ID;
}

export function Home() {
  const landingConfigPath = useMemo(resolveLandingConfigPath, []);
  return <LandingView configPath={landingConfigPath} />;
}
