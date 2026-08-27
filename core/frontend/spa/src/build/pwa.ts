import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { manifest, pwaIcons } from "../pwa-manifest";
import { dist, iconsDir, pwaAssetsDir, serviceWorkerEntry } from "./layout";

/**
 * Установочный слой. В критический путь не входит: регистрация воркера идёт на
 * `load`, а сам он кэширует уже скачанное.
 */

/**
 * Воркер собирается классическим скриптом (`iife`), а не модулем: модульные
 * service worker'ы Safari поддерживает только с 16.4, а установка нужна на всех
 * телефонах, до которых дотягиваемся.
 *
 * Список precache и идентификатор сборки подставляются здесь: воркер не должен
 * ничего знать про раскладку файлов, он получает готовые пути.
 */
export async function buildServiceWorker(
	buildId: string,
	precache: string[],
): Promise<string> {
	const result = await Bun.build({
		entrypoints: [serviceWorkerEntry],
		outdir: dist,
		naming: "sw.js",
		target: "browser",
		format: "iife",
		minify: true,
		sourcemap: "none",
		define: {
			__BUILD_ID__: JSON.stringify(buildId),
			__PRECACHE__: JSON.stringify(precache),
		},
	});

	if (!result.success) {
		throw new AggregateError(result.logs, "Build failed: service worker");
	}

	return join(dist, "sw.js");
}

export async function copyPwaIcons(): Promise<string[]> {
	await mkdir(iconsDir, { recursive: true });
	const icons = await Promise.all(
		pwaIcons.map(async (name) => {
			const source = Bun.file(join(pwaAssetsDir, name));
			if (!(await source.exists())) {
				throw new Error(`Missing PWA icon: ${join(pwaAssetsDir, name)}`);
			}
			const target = join(iconsDir, name);
			await Bun.write(target, source);
			return target;
		}),
	);
	const convergedLogo = Bun.file(
		join(pwaAssetsDir, "../../../../../../assets/converged.svg"),
	);
	if (!(await convergedLogo.exists())) {
		throw new Error("Missing Converged PWA icon");
	}
	const convergedTarget = join(iconsDir, "converged.svg");
	await Bun.write(convergedTarget, convergedLogo);
	return [...icons, convergedTarget];
}

export async function writeManifest(): Promise<string> {
	const target = join(dist, "manifest.webmanifest");
	await Bun.write(target, `${JSON.stringify(manifest, null, 2)}\n`);
	return target;
}

export { manifest } from "../pwa-manifest";
