import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import {
	bundleApp,
	bundleAudit,
	bundleMicrofrontends,
	bundleWidget,
} from "./bundles";
import { writeFunctionIndex } from "./function-index";
import { versionImportMap } from "./import-map";
import {
	assetsDir,
	clientEntry,
	dist,
	embedPage,
	frontCoreRoot,
	isProduction,
	landingAuditSourceDir,
	landingBlocksEntry,
	landingBlocksStyles,
	microfrontendDir,
	microfrontends,
	microfrontendsDir,
	pwaEnabled,
	serviceWorkerEntry,
	spaRoot,
	storeWorkerBundle,
	vendorDir,
	vendorEntriesDir,
	widgetEntry,
} from "./layout";
import { buildServiceWorker, copyPwaIcons, writeManifest } from "./pwa";
import { measure, precompress, sizeRows } from "./report";
import { buildMicrofrontendStyles, buildStyles } from "./styles";
import { buildVendor, vendorLayerFiles } from "./vendor";

/**
 * Сборка клиентской поставки: слои vendor, оболочка, микрофронтенды, виджет и
 * установочный слой. HTML здесь не собирается — первый экран рендерит SSR
 * (`front-ssr`), а поставка отдаёт ему только карту импорта и теги установки
 * (см. ../delivery.ts).
 */

/** Всё, от чего зависит результат сборки: dev-сервер по этому списку решает, пересобирать ли. */
export function sourceFiles(): string[] {
	const glob = new Bun.Glob("**/*.{ts,tsx,css,json}");
	const sources = (dir: string) =>
		Array.from(glob.scanSync({ cwd: dir, absolute: true }));
	const projectStyles = landingBlocksStyles();
	const auditSources = landingAuditSourceDir();
	return [
		join(frontCoreRoot, "../../../assets/converged.svg"),
		embedPage,
		// Блоки лендинга проекта — часть старта: правка в них обязана пересобирать
		// поставку так же, как правка в оболочке.
		...sources(dirname(landingBlocksEntry())),
		...projectStyles,
		...(auditSources ? sources(auditSources) : []),
		join(spaRoot, "uno.config.ts"),
		join(spaRoot, "uno.mf.config.ts"),
		clientEntry,
		widgetEntry,
		serviceWorkerEntry,
		storeWorkerBundle,
		...sources(join(spaRoot, "src")),
		...sources(vendorEntriesDir),
		...sources(join(frontCoreRoot, "src")),
		...microfrontends.flatMap((name) => {
			const moduleDir = microfrontendDir(name);
			const localesDir = join(moduleDir, "locales");
			return [
				...sources(join(moduleDir, "src")),
				...(existsSync(localesDir)
					? Array.from(
							new Bun.Glob("*.json").scanSync({
								cwd: localesDir,
								absolute: true,
							}),
							)
						: []),
			];
		}),
	];
}

async function copyConvergedLogo(): Promise<string> {
	const source = Bun.file(join(frontCoreRoot, "../../../assets/converged.svg"));
	if (!(await source.exists())) {
		throw new Error("Missing Converged logo asset");
	}
	const target = join(assetsDir, "converged.svg");
	await Bun.write(target, source);
	return target;
}

async function copyStoreWorker(): Promise<string> {
	const source = Bun.file(storeWorkerBundle);
	if (!(await source.exists())) {
		throw new Error(
			`Missing store worker bundle: ${storeWorkerBundle} — run \`bun run src/tools/build.ts\` in front/libraries/files/store-workers`,
		);
	}
	const target = join(assetsDir, "store.worker.js");
	await Bun.write(target, source);
	return target;
}

/** Отпечаток содержимого сборки: одинаковый выход — одинаковый кэш. */
async function appSignature(appFiles: string[], styleFiles: string[]) {
	const contents = await Promise.all(
		[...appFiles, ...styleFiles].map((path) => Bun.file(path).text()),
	);
	return Bun.hash(contents.join("")).toString(36);
}

export async function buildApp() {
	await rm(dist, { force: true, recursive: true });
	await Promise.all([
		mkdir(assetsDir, { recursive: true }),
		mkdir(vendorDir, { recursive: true }),
		mkdir(microfrontendsDir, { recursive: true }),
	]);

	// Слой микрофронтендов собирается первым и отдельно: его CSS вклеивается в
	// общий `mf.css`, поэтому стили не могут собираться параллельно с чанками.
	const microfrontendBundles = await bundleMicrofrontends();
	const microfrontendFiles = microfrontendBundles.map(
		(bundle) => bundle.script,
	);
	const microfrontendModuleStyles = microfrontendBundles.flatMap(
		(bundle) => bundle.styles,
	);

	// The vendor graph shares package entrypoints with the browser bundles.
	// Build it first so Bun does not resolve those entrypoints concurrently.
	await buildVendor();

	const appFiles = await bundleApp();
	const auditFiles = await bundleAudit();
	const widgetFiles = await bundleWidget();
	const styleFiles = await buildStyles();
	const logoFile = await copyConvergedLogo();
	const workerFile = await copyStoreWorker();
	const microfrontendStyles = await buildMicrofrontendStyles(
		microfrontendModuleStyles,
	);
	const iconFiles = await copyPwaIcons();
	const functionIndexFile = await writeFunctionIndex();

	// Пофайловые стили модулей уже внутри `mf.css`: рядом с чанками они остались
	// бы файлами, которые никто не запрашивает.
	await Promise.all(
		microfrontendModuleStyles.map((path) => rm(path, { force: true })),
	);

	// Критический путь целиком уезжает в precache: повторный запуск приложения
	// (в том числе с домашнего экрана и без сети) не делает ни одного запроса.
	// Картинки и карты исходников сюда не попадают — они тянутся по требованию и
	// оседают в том же кэше уже как runtime.
	const precache = [
		"/",
		"/manifest.webmanifest",
		// Индекс функций — метаданные, не код: он нужен каталогу с первой секунды,
		// а сами модули по-прежнему тянутся по требованию (docs/AI.md §4.2).
		`/${relative(dist, functionIndexFile)}`,
		...[...appFiles, ...styleFiles, logoFile, workerFile, ...vendorLayerFiles("app")]
			.map((path) => `/${relative(dist, path)}`)
			.filter((path) => path.endsWith(".js") || path.endsWith(".css")),
	];
	// Имя кэша меняется вместе с содержимым сборки, поэтому старый кэш новой
	// сборке просто не виден, а `activate` его удаляет.
	const revisionFiles = [
		...appFiles,
		...styleFiles,
		workerFile,
		...vendorLayerFiles("app"),
		...vendorLayerFiles("mf"),
		...microfrontendFiles,
		...widgetFiles,
		functionIndexFile,
	];
	const buildId = Bun.hash(
		precache.join("|") + (await appSignature(revisionFiles, [])),
	).toString(36);
	const deliveryImportMap = versionImportMap(buildId);
	const [serviceWorkerFile, manifestFile] = await Promise.all([
		buildServiceWorker(buildId, precache),
		writeManifest(),
	]);

	await Promise.all([
		// Страница-хост для встраиваемой формы: ни карты импорта, ни preload —
		// виджет самодостаточен, копируем как есть.
		Bun.write(join(dist, "embed.html"), Bun.file(embedPage)),
		// Карту читает контейнерная сборка прода: там SSR и SPA — разные образы.
		Bun.write(
			join(dist, "import-map.json"),
			`${JSON.stringify(deliveryImportMap, null, 2)}\n`,
		),
	]);

	// Три независимые поставки: страница приложения грузит свои файлы, чужая
	// страница — только виджет, слой микрофронтендов — вообще ничей до первого
	// вызова функции. Складывать их в один итог нечего.

	// Старт — это код: то, что браузер обязан выполнить до первого экрана.
	const appOutputs = [...appFiles, ...styleFiles, ...vendorLayerFiles("app")];

	/** Качается при первой загрузке файла, не при старте. */
	const deferredOutputs = [workerFile, ...auditFiles];

	// Установочный слой: воркер, манифест и иконки. В критический путь не входит
	// (регистрация идёт на `load`), поэтому и в бюджет старта не складывается.
	const pwaOutputs = [serviceWorkerFile, manifestFile, ...iconFiles];

	// Общие библиотеки MF существуют отдельным кэшем. Они не являются частью
	// какого-либо конкретного MF, поэтому и в отчёте измеряются отдельно.
	const dynamicVendorOutputs = vendorLayerFiles("mf");
	// Общий UnoCSS-слой нужен всем MF, но не является микрофронтендом и не
	// должен загрязнять их таблицу размеров.
	const microfrontendOutputs = [...microfrontendFiles, functionIndexFile];
	const dynamicStyleOutputs = [microfrontendStyles];

	await precompress(
		[
			...appOutputs,
			...deferredOutputs,
			...dynamicVendorOutputs,
			...dynamicStyleOutputs,
			...microfrontendOutputs,
			...widgetFiles,
			...auditFiles,
			// Картинки brotli не жмём: PNG уже сжат, .br рядом только занимал бы место.
			...pwaOutputs.filter((path) => !path.endsWith(".png")),
		].filter((path) => !path.endsWith(".map")),
	);

	const [app, deferred, widget, dynamicVendors, microfrontendLayer, pwa] =
		await Promise.all([
			measure(appOutputs),
			measure(deferredOutputs),
			measure(widgetFiles),
			measure(dynamicVendorOutputs),
			measure(microfrontendOutputs),
			measure(pwaOutputs),
		]);

	const report = {
		mode: isProduction ? "production" : "development",
		imports: deliveryImportMap.imports,
		app,
		deferred,
		widget,
		dynamicVendors,
		microfrontends: microfrontendLayer,
		pwa: { enabled: pwaEnabled, buildId, precache, ...pwa },
	};

	await Bun.write(
		join(dist, "build-report.json"),
		`${JSON.stringify(report, null, 2)}\n`,
	);

	if (process.env.SPA_BUILD_SILENT !== "1") {
		console.log("\nСтарт приложения (JS + CSS)");
		console.table(sizeRows(app));
		console.log("Отложенное (не в старте): файловый воркер");
		console.table(sizeRows(deferred));
		// У виджета CSS и файловый воркер зашиты в тот же JS, поэтому пофайловой
		// раскладки у него нет и с цифрами приложения он не складывается.
		console.log("Виджет (самодостаточный, CSS и воркер внутри JS)");
		console.table(sizeRows(widget));
		// Слой микрофронтендов не участвует в старте: он качается по действию
		// пользователя или по вызову функции из чата.
		console.log("Микрофронтенды (по требованию)");
		console.table(sizeRows(microfrontendLayer));
		console.log(
			pwaEnabled
				? `Установка (sw + манифест + иконки), сборка ${buildId}`
				: "Установка выключена (PWA_DEV=1 включает локально) — воркер снимается",
		);
		console.table(sizeRows(pwa));
	}

	return report;
}

if (import.meta.main) {
	await buildApp();
	console.log(`Built SPA delivery in ${dist}`);
}
