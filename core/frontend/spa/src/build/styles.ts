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
 * CSS is laid out in the same layers as the code: tokens and panel geometry
 * are shared with the embeddable form (it inlines the same files), the app
 * page links them as one index.css, and the chat content travels with its own chunk.
 *
 * Utilities are generated from the shell's sources: the landing markup is
 * drawn by blocks from `front-core/landing`, so they go into the generator's
 * source too.
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
		// The page markup is drawn by the project's blocks: without them the
		// generator won't see a single landing utility and will cut them from the layer.
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
			// The project's blocks layer comes last: it styles its own markup and
			// is allowed to override the shared landing rules.
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
 * Microfrontend utility CSS — its own layer and its own preset: MF views are
 * written in wind utilities, the shell in its own tokens, and there's no
 * reason to mix them. The file arrives with the first microfrontend; it's not
 * on the critical path.
 *
 * The modules' own hand-written CSS is glued in here too: `moduleStyles` is
 * what the bundler pulled out of their `import "./View.css"`. It isn't
 * shipped as its own files, because the page includes exactly one
 * `assets/mf.css` (`front-core/src/shell/mf.ts`), and an `mf/<name>.css`
 * sitting next to the chunk would never get included by anyone.
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
	// Utilities come last: they must override components' hand-written rules,
	// not the other way around.
	await Bun.write(
		target,
		[tokens, threadedChat, threadView, pellEditor, ...modules, css].join("\n"),
	);
	return target;
}
