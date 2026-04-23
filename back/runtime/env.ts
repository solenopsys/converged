function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function requireServicesBaseUrl(override?: string): string {
  const value = override ?? process.env.SERVICES_BASE;
  if (!value) {
    throw new Error(
      "SERVICES_BASE is required for runtime service calls. " +
        "Set it to the services endpoint, for example http://host:port/services.",
    );
  }
  return trimTrailingSlash(value);
}

export function requireRuntimeBaseUrl(override?: string): string {
  const value = override ?? process.env.RT_DAG_BASE ?? process.env.RUNTIME_BASE;
  if (!value) {
    throw new Error(
      "RUNTIME_BASE or RT_DAG_BASE is required for runtime-to-runtime calls. " +
        "Set it to the runtime endpoint, for example http://host:port/runtime.",
    );
  }
  return trimTrailingSlash(value);
}

export function servicesHealthUrl(servicesBaseUrl: string): string {
  const url = new URL(servicesBaseUrl);
  url.pathname = "/health";
  url.search = "";
  url.hash = "";
  return url.toString();
}
