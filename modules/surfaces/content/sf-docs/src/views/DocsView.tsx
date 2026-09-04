import { useSurfaceTranslation } from "front-core";
import { DEFAULT_LOCALE } from "front-core/landing";
import { createMarkdownServiceClient } from "g-markdown";
import { type MarkdownASTNode, MarkdownRenderer } from "md-tools";
import { useEffect, useMemo, useRef, useState } from "preact/compat";
import { createFrontNrpcClientConfig } from "signal-channel";
import { getDocsSources } from "../env";
import { type DocsSectionMeta, loadDocsSections } from "../sections";
import type { DocsSSRData } from "../ssr";

const SF_ID = "docs-sf";

type RenderSection = DocsSectionMeta & {
	ast: MarkdownASTNode | null;
};

const markdownClient = createMarkdownServiceClient(
	createFrontNrpcClientConfig(),
);

function readSsrData(indexPath: string): RenderSection[] | null {
	const data: DocsSSRData | undefined =
		typeof window === "undefined"
			? (globalThis as any).__DOCS_SSR_DATA__
			: (() => {
					try {
						const el = document.getElementById("__INITIAL_DATA__");
						return el?.textContent
							? (JSON.parse(el.textContent) as any)?.docsContent
							: undefined;
					} catch {
						return undefined;
					}
				})();
	if (!data || data.indexPath !== indexPath) return null;
	return data.sections as RenderSection[];
}

type DocsViewMode = "full" | "index" | "group" | "article";

const PRODUCT_PAGE_SECTIONS: Record<string, string[]> = {
	overview: ["converged", "overview", "solutions"],
	solutions: ["directions", "functions", "principles", "details"],
	platform: ["devices", "dag", "llm"],
	technical: ["architecture", "tehnology", "perf", "security"],
	project: ["deployment", "spending", "licensing", "oss", "roadmap"],
};

function sectionPath(locale: string, markdownPath: string): string {
	const path = markdownPath
		.replace(new RegExp(`^${locale}/`), "")
		.replace(/\.md$/i, "");
	return path;
}

function sectionSlug(locale: string, markdownPath: string): string {
	return sectionPath(locale, markdownPath).split("/").pop() ?? "";
}

function groupKey(locale: string, markdownPath: string): string {
	const path = sectionPath(locale, markdownPath);
	if (path.startsWith("product/modules/"))
		return path.split("/")[2] ?? "modules";
	const slug = sectionSlug(locale, markdownPath);
	for (const [pageKey, slugs] of Object.entries(PRODUCT_PAGE_SECTIONS)) {
		if (slugs.includes(slug)) return pageKey;
	}
	if (path.startsWith("product/functions/")) return "solutions";
	if (path.startsWith("product/")) return "overview";
	return "docs";
}

function groupHref(locale: string, markdownPath: string): string {
	const path = sectionPath(locale, markdownPath);
	if (path.startsWith("product/modules/")) {
		const group = path.split("/")[2];
		return group
			? `/${locale}/product/solutions/${group}/`
			: `/${locale}/product/solutions/`;
	}
	const pageKey = groupKey(locale, markdownPath);
	if (pageKey === "solutions") return `/${locale}/product/solutions/`;
	if (pageKey === "platform") return `/${locale}/product/platform/`;
	if (pageKey === "technical") return `/${locale}/product/technical/`;
	if (pageKey === "project") return `/${locale}/product/project/`;
	if (pageKey === "overview") return `/${locale}/product/overview/`;
	return `/${locale}/${path}/`;
}

function sectionHref(locale: string, section: RenderSection): string {
	return `${groupHref(locale, section.markdownPath)}#${section.anchor}`;
}

function isCurrentSection(
	item: RenderSection,
	locale: string,
	group?: string,
	sectionSlug?: string,
) {
	if (!sectionSlug) return false;
	const path = sectionPath(locale, item.markdownPath);
	const href = `/${locale}/${path}/`;
	if (group)
		return href === `/${locale}/product/modules/${group}/${sectionSlug}/`;
	return (
		href === `/${locale}/product/${sectionSlug}/` ||
		href === `/${locale}/product/functions/${sectionSlug}/`
	);
}

function DocsIndex({
	items,
	locale,
}: {
	items: RenderSection[];
	locale: string;
}) {
	const { t } = useSurfaceTranslation(SF_ID);
	const base = `/${locale}/product`;
	const pages = [
		{
			title: t("index.pages.overview.title") as string,
			href: `${base}/overview/`,
			text: t("index.pages.overview.text") as string,
		},
		{
			title: t("index.pages.solutions.title") as string,
			href: `${base}/solutions/`,
			text: t("index.pages.solutions.text") as string,
		},
		{
			title: t("index.pages.platform.title") as string,
			href: `${base}/platform/`,
			text: t("index.pages.platform.text") as string,
		},
		{
			title: t("index.pages.technical.title") as string,
			href: `${base}/technical/`,
			text: t("index.pages.technical.text") as string,
		},
		{
			title: t("index.pages.project.title") as string,
			href: `${base}/project/`,
			text: t("index.pages.project.text") as string,
		},
	];

	return (
		<>
			<div className="docs-markdown max-w-4xl">
				<h1>{t("index.heading") as string}</h1>
				<p>{t("index.intro") as string}</p>
			</div>
			<div className="mt-8 grid max-w-4xl gap-10">
				{pages.map((page) => (
					<section key={page.href}>
						<h2 className="mb-2 border-b border-border pb-3 text-2xl font-semibold">
							<a href={page.href}>{page.title}</a>
						</h2>
						<p className="max-w-3xl text-muted-foreground">{page.text}</p>
					</section>
				))}
			</div>
		</>
	);
}

export default function DocsView({
	indexPath,
	anchor,
	mode = "full",
	group,
	fixedGroup,
	sectionSlug,
}: {
	indexPath?: string;
	anchor?: string;
	mode?: DocsViewMode;
	group?: string;
	fixedGroup?: string;
	sectionSlug?: string;
}) {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const resolvedIndexPath =
		indexPath ??
		getDocsSources()[0]?.id ??
		`${DEFAULT_LOCALE}/product/docs/index.json`;

	const ssrSections = readSsrData(resolvedIndexPath);
	const [sections, setSections] = useState<RenderSection[]>(ssrSections ?? []);
	const [loading, setLoading] = useState(!ssrSections);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (ssrSections) return;
		let active = true;

		const loadAllSections = async () => {
			setLoading(true);
			setError(null);
			try {
				const docsSections = await loadDocsSections(resolvedIndexPath);
				if (!active) return;

				const paths = docsSections.map((item) => item.markdownPath);
				const batch = paths.length
					? await markdownClient.readMdJsonBatch(paths)
					: [];
				if (!active) return;

				setSections(
					docsSections.map((item, index) => ({
						...item,
						ast:
							((Array.isArray(batch)
								? batch[index]?.content
								: null) as MarkdownASTNode | null) ?? null,
					})),
				);
			} catch (e: any) {
				if (!active) return;
				setSections([]);
				setError(e?.message ?? "Failed to load docs");
			} finally {
				if (active) setLoading(false);
			}
		};

		loadAllSections();
		return () => {
			active = false;
		};
	}, [resolvedIndexPath]);

	const sortedItems = useMemo(
		() => [...sections].sort((a, b) => a.order - b.order),
		[sections],
	);
	const activeLocale = resolvedIndexPath.split("/")[0] || DEFAULT_LOCALE;
	const activeGroup = fixedGroup ?? group;
	const visibleItems = useMemo(
		() =>
			mode === "group"
				? sortedItems.filter(
						(item) => groupKey(activeLocale, item.markdownPath) === activeGroup,
					)
				: mode === "article"
					? sortedItems.filter((item) =>
							isCurrentSection(item, activeLocale, group, sectionSlug),
						)
					: sortedItems,
		[activeGroup, activeLocale, group, mode, sectionSlug, sortedItems],
	);

	useEffect(() => {
		if (!anchor || loading) return;
		const id = anchor.trim().toLowerCase();
		requestAnimationFrame(() => {
			const container = scrollRef.current;
			if (!container) return;
			const section = container.querySelector<HTMLElement>(`#${id}`);
			if (section) {
				container.scrollTo({ top: section.offsetTop - 8, behavior: "smooth" });
			}
		});
	}, [anchor, loading, sortedItems.length]);

	useEffect(() => {
		if (mode !== "index" || loading || typeof window === "undefined") return;
		const legacyAnchor = window.location.hash
			.replace(/^#/, "")
			.trim()
			.toLowerCase();
		if (!legacyAnchor) return;
		const section = sortedItems.find((item) => item.anchor === legacyAnchor);
		if (!section) return;
		window.location.replace(sectionHref(activeLocale, section));
	}, [activeLocale, loading, mode, sortedItems]);

	useEffect(() => {
		if (typeof document === "undefined" || loading) return;
		document.dispatchEvent(new CustomEvent("cnc:docs:sections-changed"));
	}, [loading, sortedItems.length, resolvedIndexPath]);

	return (
		<div
			ref={scrollRef}
			className="h-full min-h-0 w-full overflow-y-auto overflow-x-hidden px-6 py-8"
			data-docs-root="1"
			data-docs-index-path={resolvedIndexPath}
		>
			{error ? (
				<div className="max-w-4xl">
					<h2 className="mb-3 text-2xl font-semibold text-red-400">Error</h2>
					<p className="text-slate-300">{error}</p>
				</div>
			) : null}

			{!error && loading ? <p className="text-slate-300">Loading...</p> : null}

			{!error && !loading && sortedItems.length === 0 ? (
				<p className="text-slate-300">
					No sections found in struct: {resolvedIndexPath}
				</p>
			) : null}

			{!error && !loading && mode === "index" ? (
				<DocsIndex items={sortedItems} locale={activeLocale} />
			) : null}

			{!error && !loading && mode !== "index"
				? visibleItems.map((item) => (
						<section
							key={item.anchor}
							id={item.anchor}
							className="mb-12 scroll-mt-4"
							data-docs-section="1"
							data-docs-section-anchor={item.anchor}
							data-docs-section-name={item.title || item.anchor}
						>
							{item.ast ? (
								<div className="docs-markdown max-w-4xl">
									<MarkdownRenderer ast={item.ast} />
								</div>
							) : (
								<p className="text-slate-400">No content for {item.title}</p>
							)}
						</section>
					))
				: null}
		</div>
	);
}
