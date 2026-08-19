import { resolve } from "node:path";
import type { SeoConfig } from "./render/Document";

export type { SeoConfig } from "./render/Document";


export async function loadSeoConfig(publicDir: string): Promise<SeoConfig> {
	const seoPath = resolve(publicDir, "seo.json");
	const file = Bun.file(seoPath);
	if (!(await file.exists())) {
		throw new Error(`[ssr] missing SEO config: ${seoPath}`);
	}

	const parsed = JSON.parse(await file.text()) as Partial<SeoConfig>;
	if (!parsed.title?.trim() || !parsed.description?.trim()) {
		throw new Error(`[ssr] SEO config needs title and description: ${seoPath}`);
	}

	return {
		title: parsed.title.trim(),
		description: parsed.description.trim(),
		keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter(Boolean) : [],
		canonical: parsed.canonical,
		ogImage: parsed.ogImage,
	};
}
