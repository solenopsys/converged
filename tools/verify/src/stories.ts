/**
 * Main User Stories: what a solution promises, in the words its tests are held to.
 *
 * A solution is verified by what a person can get done with it, not by whether
 * each of its modules is alive, so the unit here is the story. Every story is a
 * file pair inside the solution's own verification directory:
 *
 *   modules/solutions/verification/<solution>/stories.json   what must hold
 *   modules/solutions/verification/<solution>/<story>.spec.ts how it is checked
 *
 * The spec file is named after the story id and nothing else ties them: no id is
 * repeated inside the test, so a renamed story cannot leave a test quietly
 * reporting under the old one.
 *
 * Node-only on purpose (no Bun APIs): the Playwright runner reads this while
 * collecting tests, and the Bun CLI reads it while planning the run.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export type Story = {
	/** Kebab-case, and the name of the spec file that checks it. */
	id: string;
	/** What the report prints: "Customer submits a request". */
	title: string;
	/** Who walks the path — the role that signs in, or "guest" for a visitor. */
	actor: string;
	/** Optional stories are run and reported but do not decide the verdict. */
	required: boolean;
	/** Acceptance Criteria: observable results, the input for test generation. */
	criteria: string[];
};

export type StoriesFile = {
	solution: string;
	/** The business outcome the stories together stand for, one sentence. */
	value: string;
	stories: Story[];
};

export const STORIES_FILE = "stories.json";
export const SPEC_SUFFIX = ".spec.ts";

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function fail(path: string, message: string): never {
	throw new Error(`[verify] ${path}: ${message}`);
}

function text(value: unknown, path: string, field: string): string {
	if (typeof value !== "string" || !value.trim()) {
		fail(path, `${field} is required and must be a non-empty string`);
	}
	return value.trim();
}

export function parseStories(raw: unknown, path: string): StoriesFile {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		fail(path, "must contain a JSON object");
	}
	const value = raw as Record<string, unknown>;
	const solution = text(value.solution, path, "solution");
	if (solution !== basename(dirname(path))) {
		fail(
			path,
			`solution "${solution}" does not match its directory "${basename(dirname(path))}"`,
		);
	}
	if (!Array.isArray(value.stories) || value.stories.length === 0) {
		fail(path, "stories must be a non-empty array");
	}

	const seen = new Set<string>();
	const stories = value.stories.map((entry, index): Story => {
		const where = `stories[${index}]`;
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
			fail(path, `${where} must be an object`);
		}
		const story = entry as Record<string, unknown>;
		const id = text(story.id, path, `${where}.id`);
		if (!ID.test(id)) fail(path, `${where}.id "${id}" must be kebab-case`);
		if (seen.has(id)) fail(path, `${where}.id "${id}" is duplicated`);
		seen.add(id);
		if (story.required !== undefined && typeof story.required !== "boolean") {
			fail(path, `${where}.required must be a boolean`);
		}
		const criteria = story.criteria;
		if (
			!Array.isArray(criteria) ||
			criteria.length === 0 ||
			criteria.some((item) => typeof item !== "string" || !item.trim())
		) {
			fail(path, `${where}.criteria must be a non-empty array of strings`);
		}
		return {
			id,
			title: text(story.title, path, `${where}.title`),
			actor: text(story.actor, path, `${where}.actor`),
			required: story.required ?? true,
			criteria: (criteria as string[]).map((item) => item.trim()),
		};
	});

	return { solution, value: text(value.value, path, "value"), stories };
}

export function readStories(dir: string): StoriesFile {
	const path = join(dir, STORIES_FILE);
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		fail(path, `cannot read JSON: ${String(error)}`);
	}
	return parseStories(raw, path);
}

/** The story a spec file checks, found from the file's own path. */
export function storyOfSpec(file: string): { solution: string; story: Story } {
	const id = basename(file).slice(0, -SPEC_SUFFIX.length);
	const stories = readStories(dirname(file));
	const story = stories.stories.find((entry) => entry.id === id);
	if (!story) {
		fail(
			file,
			`no story "${id}" in ${STORIES_FILE} — a spec is named after the story it checks`,
		);
	}
	return { solution: stories.solution, story };
}

export type Coverage = {
	/** Stories with a spec, in stories.json order. */
	specs: Array<{ story: Story; file: string }>;
	/** Stories nobody wrote a test for yet. */
	missing: Story[];
	/** Spec files that check no story. */
	orphans: string[];
};

export function coverageOf(dir: string, stories: StoriesFile): Coverage {
	const files = existsSync(dir)
		? readdirSync(dir).filter((name) => name.endsWith(SPEC_SUFFIX))
		: [];
	const ids = new Set(stories.stories.map((story) => story.id));
	const coverage: Coverage = { specs: [], missing: [], orphans: [] };
	for (const story of stories.stories) {
		const name = `${story.id}${SPEC_SUFFIX}`;
		if (files.includes(name)) {
			coverage.specs.push({ story, file: join(dir, name) });
		} else {
			coverage.missing.push(story);
		}
	}
	for (const name of files) {
		if (!ids.has(name.slice(0, -SPEC_SUFFIX.length))) {
			coverage.orphans.push(join(dir, name));
		}
	}
	return coverage;
}
