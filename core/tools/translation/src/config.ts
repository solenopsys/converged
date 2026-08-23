/** Loading the config and the two records a run reads. */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ControlConfig, ControlState } from "./types";

export function readConfig(path: string): {
	config: ControlConfig;
	path: string;
} {
	const configPath = resolve(path);
	const config = JSON.parse(readFileSync(configPath, "utf8")) as ControlConfig;

	if (
		!config ||
		!Array.isArray(config.projects) ||
		config.projects.length === 0
	) {
		throw new Error(
			`Config ${configPath} must contain a non-empty projects array`,
		);
	}
	for (const project of config.projects) {
		if (
			!project.name ||
			!project.root ||
			!project.sourceLocale ||
			!Array.isArray(project.targetLocales)
		) {
			throw new Error(
				`Invalid project in ${configPath}: name, root, sourceLocale and targetLocales are required`,
			);
		}
	}

	return { config, path: configPath };
}

export function readState(path: string): ControlState {
	if (!existsSync(path)) return { version: 1, updatedAt: "", projects: {} };

	const state = JSON.parse(readFileSync(path, "utf8")) as ControlState;
	if (state.version !== 1 || !state.projects) {
		throw new Error(`Unsupported translation state format: ${path}`);
	}
	return state;
}
