import { join } from "node:path";
import { createGenerator } from "unocss";
import unoConfig from "../../uno.config";
import unoMicrofrontendConfig from "../../uno.mf.config";
import {
	assetsDir,
	clientEntry,
	frontCoreRoot,
	landingAuditSourceDir,
	landingBlocksEntry,
	landingBlocksStyles,
	microfrontendDir,
	microfrontends,
} from "./layout";
import { dirname } from "node:path";

const stylesDir = join(frontCoreRoot, "src", "styles");

async function buildAuditStyles(auditRoot: string): Promise<string> {
	const glob = new Bun.Glob("**/*.{ts,tsx}");
	const sources = Array.from(glob.scanSync({ cwd: auditRoot, absolute: true }));
	const contents = await Promise.all(sources.map((file) => Bun.file(file).text()));
	const module = await import(join(auditRoot, "theme", "uno.config.ts"));
	const uno = await createGenerator(module.auditUnoConfig);
	const { css } = await uno.generate(contents.join("\n"), { preflights: true });
	return css;
}

/**
 * CSS разложен по тем же слоям, что и код: токены и геометрия панели общие с
 * встраиваемой формой (она инлайнит те же файлы), страница приложения линкует
 * их одним index.css, содержимое чата едет со своим чанком.
 *
 * Утилиты генерируются по исходникам оболочки: разметку лендинга рисуют блоки
 * из `front-core/landing`, поэтому в источник для генератора идут и они.
 */
export async function buildStyles(): Promise<string[]> {
	const glob = new Bun.Glob("**/*.{ts,tsx}");
	const shellSources = [
		clientEntry,
		...Array.from(
			glob.scanSync({ cwd: join(frontCoreRoot, "src", "landing"), absolute: true }),
		),
		...Array.from(
			glob.scanSync({ cwd: join(frontCoreRoot, "src", "shell"), absolute: true }),
		),
		// Разметку страницы рисуют блоки проекта: без них генератор не увидит ни
		// одной утилиты лендинга и вырежет их из слоя.
		...Array.from(glob.scanSync({ cwd: dirname(landingBlocksEntry()), absolute: true })),
	];
	const shellSource = (
		await Promise.all(shellSources.map((file) => Bun.file(file).text()))
	).join("\n");

	const uno = await createGenerator(unoConfig);
	const { css: utilities } = await uno.generate(shellSource, { preflights: true });
	const layer = (...parts: string[]) => Bun.file(join(...parts)).text();
	const projectStyles = landingBlocksStyles();
	const auditRoot = landingAuditSourceDir();
	const [tokens, landingTokens, base, panel, chat, diagrams, productCases, vectorImage, cncLanding, surface, topBar, blocks, audit] =
		await Promise.all([
			layer(stylesDir, "tokens.css"),
			layer(stylesDir, "landing-tokens.css"),
			layer(stylesDir, "base.css"),
			layer(stylesDir, "panel.css"),
			layer(frontCoreRoot, "src", "chat", "chat.css"),
			layer(stylesDir, "diagrams.css"),
			layer(stylesDir, "product-cases.css"),
			layer(stylesDir, "vector-image.css"),
			layer(stylesDir, "cnc-landing.css"),
			layer(stylesDir, "surface.css"),
			layer(stylesDir, "topbar.css"),
			// Слой блоков проекта идёт последним: он одевает собственную разметку и
			// имеет право переопределить общие правила лендинга.
			Promise.all(projectStyles.map((path) => Bun.file(path).text())).then(
				(styles) => styles.join("\n"),
			),
			auditRoot ? buildAuditStyles(auditRoot) : "",
		]);

	await Promise.all([
		Bun.write(
			join(assetsDir, "index.css"),
			[utilities, tokens, landingTokens, panel, base, topBar, surface, diagrams, productCases, vectorImage, cncLanding, blocks, audit].join("\n"),
		),
		Bun.write(join(assetsDir, "chat.css"), chat),
	]);

	return [join(assetsDir, "index.css"), join(assetsDir, "chat.css")];
}

/**
 * Утилитарный CSS микрофронтендов — свой слой и свой пресет: вьюхи MF написаны
 * на wind-утилитах, оболочка — на собственных токенах, и смешивать их незачем.
 * Файл приезжает при первом микрофронтенде, в критическом пути его нет.
 *
 * Сюда же вклеивается рукописный CSS самих модулей: `moduleStyles` — это то,
 * что бандлер вытащил из их `import "./View.css"`. Своими файлами он не
 * поставляется, потому что страница подключает ровно один `assets/mf.css`
 * (`front-core/src/shell/mf.ts`), и лежащий рядом с чанком `mf/<name>.css`
 * не подключал бы никто.
 */
export async function buildMicrofrontendStyles(moduleStyles: string[] = []): Promise<string> {
	const glob = new Bun.Glob("**/*.{ts,tsx}");
	const files = [
		...Array.from(glob.scanSync({ cwd: join(frontCoreRoot, "src"), absolute: true })),
		...microfrontends.flatMap((name) =>
			Array.from(
				glob.scanSync({ cwd: join(microfrontendDir(name), "src"), absolute: true }),
			),
		),
	];
	const sources = (
		await Promise.all(files.map((file) => Bun.file(file).text()))
	).join("\n");

	const uno = await createGenerator(unoMicrofrontendConfig);
	const { css } = await uno.generate(sources, { preflights: true });
	const tokens = await Bun.file(join(stylesDir, "mf-tokens.css")).text();
	// Hand-written component CSS (custom class names UnoCSS can't derive from
	// scanning utility strings) rides alongside the generated utilities.
	const [threadedChat, threadView, pellEditor] = await Promise.all([
		Bun.file(join(frontCoreRoot, "src", "components", "chat", "ThreadedChat.css")).text(),
		Bun.file(join(frontCoreRoot, "src", "components", "chat", "ThreadView.css")).text(),
		Bun.file(join(frontCoreRoot, "src", "components", "ui", "pell-editor.css")).text(),
	]);
	const modules = await Promise.all(
		moduleStyles.map((path) => Bun.file(path).text()),
	);

	const target = join(assetsDir, "mf.css");
	// Утилиты идут последними: они обязаны перебивать рукописные правила
	// компонентов, а не наоборот.
	await Bun.write(
		target,
		[tokens, threadedChat, threadView, pellEditor, ...modules, css].join("\n"),
	);
	return target;
}
