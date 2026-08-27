import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Раскладка поставки в одном месте: всё остальное в сборке адресуется отсюда.
 * Пакет живёт внутри `front/`, поэтому корни соседних пакетов считаются от
 * него, а не от PROJECT_DIR — сборка не должна зависеть от того, из какого
 * каталога её запустили.
 */

export const spaRoot = resolve(import.meta.dir, "..", "..");
export const frontRoot = resolve(spaRoot, "..");
export const frontCoreRoot = join(frontRoot, "front-core");
export const microfrontendsRoot = join(frontRoot, "microfrontends");
const projectMicrofrontendsRoots = [
	process.env.CHILD_PROJECT_DIR,
	process.env.PROJECT_DIR,
]
	.filter((projectDir): projectDir is string => Boolean(projectDir?.trim()))
	.flatMap((projectDir) => [
		join(resolve(projectDir), "front", "microfrontends"),
		join(resolve(projectDir), "modules", "microfrontends"),
	]);
export const microfrontendsRoots = [
	...projectMicrofrontendsRoots,
	microfrontendsRoot,
].filter((root) => existsSync(root));

/**
 * Delivery-wide source audit. A project build may select only a subset of
 * modules, but an incompatible public import in any maintained delivery must
 * be caught before it reaches a browser.
 *
 * A function, not a constant: this used to glob `*​/front/microfrontends` from
 * a directory derived by walking up out of this file. Bundled, `import.meta.dir`
 * collapses and that walk lands on `/`, so merely importing this module scanned
 * the whole filesystem and died on the first unreadable directory. The roots
 * the rest of the build already agrees on are the same deliveries, so they are
 * reused rather than rediscovered.
 */
export function microfrontendContractRoots(): string[] {
	return [...new Set(microfrontendsRoots)];
}

/**
 * A child project owns its landing host while the base project supplies shared
 * frontend packages. Prefer the child so SSR and the browser register the
 * same block map; retain legacy `front/landing` support during migration.
 */
function landingProjectDir(): string {
	const projectDirs = [process.env.CHILD_PROJECT_DIR, process.env.PROJECT_DIR]
		.filter((value): value is string => Boolean(value?.trim()))
		.map((value) => resolve(value));

	for (const projectDir of projectDirs) {
		for (const relativePath of ["core/frontend/landing", "front/landing"]) {
			const landingDir = join(projectDir, relativePath);
			if (existsSync(join(landingDir, "src", "blocks", "index.tsx"))) {
				return landingDir;
			}
		}
	}

	throw new Error(
		`[spa] landing blocks not found in: ${projectDirs.join(", ")}`,
	);
}

/** Карта блоков лендинга проекта: `type` из хранилища → компонент. */
export function landingBlocksEntry(): string {
	return join(landingProjectDir(), "src", "blocks", "index.tsx");
}

/**
 * Реэкспорт блоков проекта внутри поставки: его пишет сборка, а импортирует
 * точка входа. Лежит рядом с ней, потому что обычный относительный импорт —
 * единственный способ сохранить `tsconfig` проекта (см. build/bundles.ts).
 */
export function landingBlocksShim(): string {
	return join(spaRoot, "src", "client", "landing-blocks.ts");
}

/**
 * Стилевой слой блоков проекта. В отличие от карты блоков он необязателен:
 * проект, чьи блоки одеты стилями ядра, своего слоя не заводит.
 */
export function landingBlocksStyles(): string[] {
	const blocksDir = join(landingProjectDir(), "src", "blocks");
	const stylesDir = join(blocksDir, "styles");
	const componentStyles = existsSync(stylesDir)
		? Array.from(
			new Bun.Glob("**/*.css").scanSync({
				cwd: stylesDir,
				absolute: true,
			}),
		).sort()
		: [];
	const legacy = join(blocksDir, "blocks.css");
	return componentStyles.length > 0
		? componentStyles
		: existsSync(legacy)
			? [legacy]
			: [];
}

/**
 * Изолированный стиль страницы может жить рядом с лендингом, но должен стать
 * обычным артефактом поставки, а не собираться из исходников на сервере.
 */
export function landingAuditSourceDir(): string | undefined {
	const source = join(landingProjectDir(), "src", "audit");
	return existsSync(source) ? source : undefined;
}

export function landingAuditClientEntry(
	name: "landing" | "print",
): string | undefined {
	const source = landingAuditSourceDir();
	if (!source) return undefined;
	const entry = join(
		source,
		"client",
		`${name}.${name === "landing" ? "tsx" : "ts"}`,
	);
	return existsSync(entry) ? entry : undefined;
}

export function landingAuditShim(): string {
	return join(spaRoot, "src", "client", "audit-page.ts");
}

/**
 * Точки входа интерактивного аудита принадлежат проекту-хосту. Их нельзя
 * собирать при первом HTTP-запросе: в production они должны быть обычными
 * модулями поставки и пользоваться общей import map.
 */
export const dist = join(spaRoot, "dist");
export const assetsDir = join(dist, "assets");
export const vendorDir = join(dist, "vendor");
export const microfrontendsDir = join(dist, "mf");
export const iconsDir = join(dist, "icons");
export const widgetDir = join(dist, "widget");

export const clientEntry = join(spaRoot, "src", "client", "main.tsx");
export const widgetEntry = join(spaRoot, "src", "client", "widget.tsx");
export const embedPage = join(spaRoot, "src", "client", "embed.html");
export const serviceWorkerEntry = join(
	spaRoot,
	"src",
	"sw",
	"service-worker.ts",
);
export const vendorEntriesDir = join(spaRoot, "src", "vendor", "entries");
export const pwaAssetsDir = join(spaRoot, "src", "assets", "pwa");

// Файловый воркер — собственный ESM-бандл библиотеки store-workers (у него свой
// global scope, importmap туда не действует). Здесь он только копируется.
export const storeWorkerBundle = join(
	frontRoot,
	"libraries",
	"files",
	"store-workers",
	"dist",
	"store.worker.js",
);

export const isProduction = process.env.NODE_ENV === "production";

/**
 * Debug instrumentation is selected when the delivery is built. It is not a
 * browser preference: every client of one delivery executes the same graph.
 */
export const effectorDebug =
	process.env.EFFECTOR_DEBUG === "1" ||
	(process.env.EFFECTOR_DEBUG !== "0" && !isProduction);

export const clientBuildDefines = {
	__EFFECTOR_DEBUG__: effectorDebug ? "true" : "false",
};

/**
 * Установка на телефон включается в проде; локально — по `PWA_DEV=1`.
 * В dev воркер выключен намеренно: он кэширует слои по идентификатору сборки,
 * а dev-сервер пересобирает их на каждый запрос.
 */
export const pwaEnabled =
	isProduction || process.env.PWA_DEV === "1" || process.env.PWA_DEV === "true";

/**
 * Микрофронтенды, переведённые на контракт `front-core` (без `Widget.placement`,
 * с декларацией `SCREENS`). Список растёт волнами миграции — см.
 * refactoring/PLAN.md §5; полный перечень поставки лежит в `config.json`, и
 * пока он шире мигрированного, поставку задаёт этот список или `MICROFRONTENDS`.
 */
export const microfrontends =
	// Set-but-empty is not the same as unset, and the difference is what an image
	// build relies on: it carries no microfrontends at all, because they are
	// fetched from the registry at runtime. Unset stays the dev default.
	(
		process.env.MICROFRONTENDS === undefined
			? ["functions", "static"]
			: process.env.MICROFRONTENDS.split(",")
	)
		.map((name) => name.trim().replace(/^mf-/, ""))
		.filter(Boolean);

/**
 * Микрофронтенды разложены по предметным папкам, а в поставке адресуются
 * коротким именем: `functions` → `microfrontends/ai/mf-functions`.
 */
export function microfrontendDir(name: string): string {
	for (const root of microfrontendsRoots) {
		const direct = join(root, `mf-${name}`);
		if (existsSync(direct)) return direct;

		const [match] = new Bun.Glob(`*/mf-${name}`).scanSync({
			cwd: root,
			onlyFiles: false,
		});
		if (match) return join(root, match);
	}
	throw new Error(
		`Microfrontend not found: mf-${name} in ${microfrontendsRoots.join(", ")}`,
	);
}
