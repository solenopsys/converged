import path, { join } from "path";

import { mkdirSync, renameSync } from "fs";

export function existsFile(path: string): Promise<boolean> {
	return Bun.file(path).exists();
}

export async function copyFile(source: string, target: string) {
	const file = Bun.file(source);
	await Bun.write(target, file);
}

export function renameFileToInxexJs(pathToFile: string): string {
	const dir = path.dirname(pathToFile);
	const fileName = path.basename(pathToFile);
	const newPath = dir + "/index.js";
	renameSync(pathToFile, newPath);
	return newPath;
}
