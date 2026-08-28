import { tmpdir } from "node:os";
import { join } from "node:path";
import { microfrontendDir, microfrontends, microfrontendsDir } from "./layout";

/**
 * Индекс функций поставки: имя модуля, его краткое описание и список функций с
 * краткими описаниями (docs/AI.md §4.2).
 *
 * Зачем он есть. Каталог функций наполняется через `plug(bus)` при загрузке
 * микрофронтенда, а модули грузятся лениво — на свежей странице каталог пуст, и
 * шагу выбора функции нечего показывать. Терять ленивую загрузку нельзя: она и
 * даёт лёгкий старт. Индекс — компенсация: метаданные приезжают сразу, код —
 * по требованию.
 *
 * Второго источника правды не появляется: индекс собирается из тех же
 * деклараций (`src/functions.ts`), которые модуль регистрирует в рантайме. В dev
 * он пересобирается вместе с остальной поставкой, в контейнер уезжает готовым
 * файлом.
 */

export type IndexedFunction = {
	id: string;
	/** Однострочник для компактного контекста LLM. */
	brief: string;
	category: string;
	/** Полное описание — им отвечает `describeFunction`, в список оно не идёт. */
	description: string;
	exposure: "llm" | "user";
	priority: "primary" | "normal" | "secondary";
	access?: "public";
	capability?: string;
	parameters?: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
};

export type IndexedModule = {
	/** Имя модуля в карте импорта: `mf-orders`. */
	module: string;
	brief: string;
	functions: IndexedFunction[];
};

export type FunctionIndex = {
	/** Ключ — короткое имя поставки (`orders`), как в `/mf/orders.js`. */
	modules: Record<string, IndexedModule>;
};

/**
 * Фабрика действия получает шину, чтобы уметь звать соседей. На этапе сборки
 * шина не нужна — декларация обязана быть статической, — но подсунуть что-то
 * надо: заглушка громко падает, если фабрика попробует ею воспользоваться.
 */
const declarationOnlyBus = new Proxy(
	{},
	{
		get(_target, property) {
			throw new Error(
				`[function-index] Action factory touched the bus (.${String(property)}) at build time: ` +
					"declarations must be static",
			);
		},
	},
);

/**
 * `functions.ts` тянет за собой домен модуля, тот — эффектор, транспорт, вьюхи.
 * Ничего из этого декларации не нужно, а в серверном рантайме половина и не
 * резолвится (браузерные пакеты, `.tsx`, workspace-соседи без установленных
 * зависимостей). Поэтому модуль собирается тем же бандлером, что и поставка, а
 * всё внешнее подменяется универсальной заглушкой.
 *
 * Заглушка отдаётся прототипом, а не объектом: интероп бандлера (`__toESM`)
 * копирует только собственные ключи, и любое неизвестное имя обязано доехать по
 * цепочке прототипов, иначе именованные импорты станут `undefined`.
 */
const stubExternals = {
	name: "function-index-stub-externals",
	setup(build: Bun.PluginBuilder) {
		build.onResolve({ filter: /.*/ }, (args) =>
			args.path.startsWith(".") || args.path.startsWith("/")
				? null
				: { path: args.path, namespace: "fnidx-stub" },
		);
		build.onLoad({ filter: /.*/, namespace: "fnidx-stub" }, () => ({
			contents: `
				const hit = () => new Proxy(function(){}, {
					get: (_t, p) => (p === "__esModule" ? true : hit()),
					apply: () => hit(),
					construct: () => hit(),
				});
				module.exports = Object.create(hit());`,
			loader: "js" as const,
		}));
	},
};

type ActionDeclaration = {
	id: string;
	access?: "public";
	capability?: string;
};

/**
 * Модуль вправе требовать браузерный bootstrap на верхнем уровне (и падать без
 * него — так и задумано). Для чтения деклараций ставим заведомо нерабочие
 * адреса: любая попытка ими воспользоваться должна упасть заметно, а не увести
 * сборку в чужой контур.
 */
async function withBrowserBootstrap<T>(read: () => Promise<T>): Promise<T> {
	const globals = globalThis as Record<string, unknown>;
	const keys = [
		"__FUJIN_WS_URL__",
		"__FUJIN_BROWSER_SCOPE__",
	] as const;
	const saved = keys.map((key) => [key, globals[key]] as const);
	for (const key of keys) {
		globals[key] ??= "http://function-index.invalid";
	}
	try {
		return await read();
	} finally {
		for (const [key, value] of saved) {
			if (value === undefined) delete globals[key];
			else globals[key] = value;
		}
	}
}

/** Первый сегмент id — он же категория по умолчанию, он же ключ ленивой загрузки. */
function categoryOf(id: string): string {
	return id.split(".", 1)[0] ?? "other";
}

async function readModuleBrief(dir: string): Promise<string> {
	const manifest = Bun.file(join(dir, "package.json"));
	if (!(await manifest.exists())) return "";
	const { description } = (await manifest.json()) as { description?: string };
	return description ?? "";
}

/**
 * Декларации лежат либо файлом, либо каталогом — модуль на десяток доменов
 * (`mf-mailing`) разносит их по файлам и собирает в `functions/index.ts`. Это
 * одна и та же сущность, и `index.ts` модуля импортирует её одинаково
 * (`./functions`), поэтому индекс обязан читать обе формы: разница в раскладке
 * не должна решать, попадёт функция в каталог или нет.
 */
async function declarationsEntry(dir: string): Promise<string | undefined> {
	for (const candidate of [
		join(dir, "src", "functions.ts"),
		join(dir, "src", "functions", "index.ts"),
	]) {
		if (await Bun.file(candidate).exists()) return candidate;
	}
	return undefined;
}

type LlmCatalog = {
	actions: Record<string, Omit<IndexedFunction, "id" | "access" | "capability">>;
};

async function readLlmCatalog(dir: string, name: string): Promise<LlmCatalog> {
	const file = Bun.file(join(dir, "llm.json"));
	if (!(await file.exists())) {
		throw new Error(`[function-index] mf-${name}: missing llm.json`);
	}
	const catalog = (await file.json()) as LlmCatalog;
	if (!catalog.actions || typeof catalog.actions !== "object") {
		throw new Error(`[function-index] mf-${name}: llm.json must contain an actions object`);
	}
	return catalog;
}

/**
 * Набор фабрик экспортируется под двумя именами: `default` у модулей с файлом
 * деклараций и `ACTIONS` у модулей с каталогом (там `default` занят — из
 * `functions/index.ts` реэкспортируются ещё и колонки с полями). Регистрируют
 * их одинаково — `new BasePlugin(ID, ACTIONS)`, — значит и читаются они здесь
 * одинаково.
 */
type DeclarationExports = {
	default?: Array<(bus: unknown) => ActionDeclaration>;
	ACTIONS?: Array<(bus: unknown) => ActionDeclaration>;
};

/**
 * Индекс — метаданные, а не поставка: модуль, декларации которого не читаются,
 * попадает в индекс пустым и остаётся вызываемым как раньше (его функции
 * зарегистрируются при загрузке). Ронять из-за этого сборку приложения нельзя —
 * немигрированные MF импортируют вещи, которых в серверном рантайме нет.
 */
async function readDeclarations(dir: string, name: string): Promise<ActionDeclaration[]> {
	const source = await declarationsEntry(dir);
	if (!source) {
		console.warn(
			`[function-index] mf-${name}: no src/functions.ts nor src/functions/index.ts — module declares no functions`,
		);
		return [];
	}

	try {
		const bundle = await Bun.build({
			entrypoints: [source],
			target: "bun",
			format: "esm",
			plugins: [stubExternals],
		});
		if (!bundle.success) {
			console.warn(
				`[function-index] mf-${name}: declarations unbundlable — skipped (${bundle.logs.join("; ")})`,
			);
			return [];
		}

		// Импорт из data-URL упирается в длину имени модуля, поэтому бандл едет
		// через файл рядом с остальными артефактами сборки.
		//
		// Файл нельзя ни удалять, ни переписывать: `import()` заносит его в module
		// graph, а `bun --watch` перезапускает процесс на любое изменение
		// наблюдаемого файла. Удаление после импорта загоняло dev-сервер в
		// бесконечный цикл «сборка → удаление → рестарт → сборка». Имя считается от
		// содержимого: новый бандл — всегда новый путь и свежий импорт, неизменный —
		// тот же путь и тот же кэш модуля.
		const text = await bundle.outputs[0].text();
		const compiled = join(tmpdir(), `fnidx-${Bun.hash(text).toString(36)}.mjs`);
		if (!(await Bun.file(compiled).exists())) await Bun.write(compiled, text);
		const module = (await withBrowserBootstrap(
			() => import(compiled) as Promise<DeclarationExports>,
		)) as DeclarationExports;
		const factories = module.default ?? module.ACTIONS;
		if (!Array.isArray(factories)) {
			console.warn(
				`[function-index] mf-${name}: ${source} must export an array of action factories ` +
					"as `default` or `ACTIONS` — skipped",
			);
			return [];
		}
		return factories.map((factory) => factory(declarationOnlyBus));
	} catch (error) {
		console.warn(
			`[function-index] mf-${name}: declarations unreadable — skipped (${
				error instanceof Error ? error.message : String(error)
			})`,
		);
		return [];
	}
}

export async function collectFunctionIndex(): Promise<FunctionIndex> {
	const entries: Array<[string, IndexedModule]> = [];
	for (const name of microfrontends) {
		const dir = microfrontendDir(name);
		// Заглушка не должна ронять сборку: фабрика, потрогавшая шину, просто
		// не попадёт в индекс — см. readDeclarations.
		const brief = await readModuleBrief(dir);
		const declarations = await readDeclarations(dir, name);
		const llm = await readLlmCatalog(dir, name);

		entries.push([
			name,
			{
				module: `mf-${name}`,
				brief,
				functions: declarations.map((action) => {
					const meta = llm.actions[action.id];
					if (!meta) throw new Error(`[function-index] mf-${name}: missing llm metadata for ${action.id}`);
					return { id: action.id, ...meta, ...(action.access ? { access: action.access } : {}), ...(action.capability ? { capability: action.capability } : {}) };
				}),
			},
		]);
	}

	return { modules: Object.fromEntries(entries) };
}

/** Кладётся рядом с бандлами модулей: тот же слой, та же ленивая природа. */
export async function writeFunctionIndex(): Promise<string> {
	const index = await collectFunctionIndex();
	const target = join(microfrontendsDir, "index.json");
	await Bun.write(target, `${JSON.stringify(index, null, 2)}\n`);
	return target;
}
