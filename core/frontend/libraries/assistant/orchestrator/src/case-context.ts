/** The language codes CASE indexes. Browser locales such as `pt-BR` normalize to these. */
export type CaseLanguage = "en" | "ru" | "de" | "fr" | "es" | "it" | "pt";

export type CaseActionRoot = {
	surface: string;
	baseType: string;
};

/** The subset of an effector action metadata record required for routing. */
export type CaseAction = {
	id: string;
	exposure?: "llm" | "user";
	root?: CaseActionRoot;
	examples?: Partial<Record<CaseLanguage, readonly string[]>>;
};

export type CaseContext = {
	key: string;
	sections: Array<{
		id: string;
		commands: Array<{
			id: string;
			examples: Partial<Record<CaseLanguage, string[]>>;
		}>;
	}>;
};

const supported = new Set<CaseLanguage>(["en", "ru", "de", "fr", "es", "it", "pt"]);

/** Turns `ru-RU` / `pt-BR` into the matching CASE language, or leaves it absent. */
export function caseLanguage(locale: string): CaseLanguage | undefined {
	const language = locale.trim().toLowerCase().split(/[-_]/, 1)[0];
	return language && supported.has(language as CaseLanguage)
		? (language as CaseLanguage)
		: undefined;
}

/**
 * Produces the compact upload form CASE accepts. English is the common
 * fallback vocabulary; the user's current language is included alongside it.
 * Descriptions, schemas and non-user actions stay out.
 */
export function buildCaseContext(
	key: string,
	locale: string,
	actions: Iterable<CaseAction>,
): CaseContext {
	const language = caseLanguage(locale);
	const languages = new Set<CaseLanguage>(["en"]);
	if (language) languages.add(language);
	const sections = new Map<string, CaseContext["sections"][number]>();

	for (const action of actions) {
		if (action.exposure && action.exposure !== "user") continue;
		const root = action.root;
		const examples = Object.fromEntries(
			[...languages].flatMap((code) => {
				const phrases = action.examples?.[code]
					?.map((value) => value.trim())
					.filter(Boolean);
				return phrases?.length ? [[code, [...new Set(phrases)]]] : [];
			}),
		) as Partial<Record<CaseLanguage, string[]>>;
		if (!root || Object.keys(examples).length === 0) continue;

		// Both values form the first CASE level. A shared action vocabulary may
		// contain "show statistics" in more than one surface, and surface alone
		// is not enough when a surface owns several base entity types.
		const sectionId = `${root.surface}:${root.baseType}`;
		let section = sections.get(sectionId);
		if (!section) {
			section = { id: sectionId, commands: [] };
			sections.set(sectionId, section);
		}
		if (section.commands.some((command) => command.id === action.id)) continue;
		section.commands.push({
			id: action.id,
			examples,
		});
	}

	return {
		key,
		sections: [...sections.values()].map((section) => ({
			...section,
			commands: section.commands.sort((left, right) =>
				left.id.localeCompare(right.id),
			),
		})),
	};
}
