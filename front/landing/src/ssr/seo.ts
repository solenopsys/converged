import { resolve } from "path";

export interface SeoConfig {
  title: string;
  description: string;
  keywords: string[];
  canonical?: string;
  ogImage?: string;
}

const defaultSeo: SeoConfig = {
  title: "Converged AI",
  description: "Converged AI landing page.",
  keywords: ["Converged AI", "4ir", "AI assistant"],
};

export async function loadSeoConfig(publicDir: string): Promise<SeoConfig> {
  const seoPath = resolve(publicDir, "seo.json");
  try {
    const file = await Bun.file(seoPath).text();
    const parsed = JSON.parse(file) as Partial<SeoConfig>;
    return {
      ...defaultSeo,
      ...parsed,
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.filter(Boolean)
        : defaultSeo.keywords,
    };
  } catch {
    return defaultSeo;
  }
}
