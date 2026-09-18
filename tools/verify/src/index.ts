/**
 * What a story spec is written with.
 *
 * A spec is one Main User Story walked through the real UI. It imports only
 * this module, and this module only offers actions a person has: sign in as a
 * role, open a place in the console, type, click, upload. Anything a story
 * needs that is not here belongs in `primitives.ts` next to the others, so the
 * next generated test finds it instead of writing its own.
 *
 *   import { expect, story } from "solution-verify";
 *
 *   story(import.meta.url, async ({ page, signIn, workspace }) => {
 *     await signIn("operator");
 *     await workspace.open("requests");
 *     await expect(page.getByRole("heading", { name: "Requests" })).toBeVisible();
 *   });
 *
 * The story itself — title, actor, criteria — is read from `stories.json` by
 * the spec's file name, so the test never restates it.
 */

import { fileURLToPath } from "node:url";
import { test as base, expect } from "@playwright/test";
import {
	type Asset,
	assetOf,
	type SignIn,
	signInWith,
	uniqueName,
	type Workspace,
	workspaceOf,
} from "./primitives";
import { storyOfSpec } from "./stories";

export type StoryFixtures = {
	/** Enter the application as a role; `"guest"` stays anonymous. */
	signIn: SignIn;
	/** The console: open a surface, pick a section tab or a view tab. */
	workspace: Workspace;
	/** A name no other run or worker will produce, for data the story creates. */
	unique: (prefix: string) => string;
	/** A file from the story's `assets/` directory, for uploads. */
	asset: Asset;
};

// Playwright reads a fixture's dependencies off its first parameter and demands
// a destructuring pattern there, so the empty ones are required, not sloppy.
/* biome-ignore-start lint/correctness/noEmptyPattern: Playwright fixture signature */
export const test = base.extend<StoryFixtures>({
	signIn: async ({ page }, use) => use(signInWith(page)),
	workspace: async ({ page }, use) => use(workspaceOf(page)),
	unique: async ({}, use, testInfo) =>
		use((prefix) => uniqueName(prefix, testInfo.workerIndex)),
	asset: async ({}, use, testInfo) => use(assetOf(testInfo.file)),
});
/* biome-ignore-end lint/correctness/noEmptyPattern: Playwright fixture signature */

export { expect };

type StoryBody = Parameters<typeof test>[2];

/**
 * Declare the test for the story this file is named after.
 *
 * The solution and story ride along as annotations: that is how the reporter
 * turns Playwright's list of tests back into "which solution is verified".
 */
export function story(moduleUrl: string, body: StoryBody): void {
	const file = fileURLToPath(moduleUrl);
	const { solution, story: entry } = storyOfSpec(file);
	test(
		entry.title,
		{
			tag: entry.required ? "@required" : "@optional",
			annotation: [
				{ type: "solution", description: solution },
				{ type: "story", description: entry.id },
				{ type: "actor", description: entry.actor },
			],
		},
		body,
	);
}
