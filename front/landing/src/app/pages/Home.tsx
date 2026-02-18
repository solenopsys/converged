import { useMemo } from "react";
import LandingView from "../../../../microfrontends/mf-landing/src/views/LandingView";

const DEFAULT_LANDING_CONF_ID = "ru/product/landing/4ir-laiding.json";

function resolveLandingConfigPath(): string {
  if (typeof window === "undefined") return DEFAULT_LANDING_CONF_ID;
  const value = (window as any).__MF_ENV__?.["mf-landing"]?.landingConfId;
  return typeof value === "string" && value.trim().length > 0
    ? value
    : DEFAULT_LANDING_CONF_ID;
}

export function Home() {
  const landingConfigPath = useMemo(resolveLandingConfigPath, []);
  return <LandingView configPath={landingConfigPath} />;
}
