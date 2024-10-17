import { readdirSync, fstatSync, openSync } from "fs";

export function extractBootstrapsDirs(rootDir: string): {
	[name: string]: string;
} {
	const dirs: { [name: string]: string } = {};
	const dir = rootDir + "/bootstraps";
	const files = readdirSync(dir);
	for (const file of files) {
		const filePath = dir + "/" + file;
		const fileDescriptor = openSync(filePath, "r");
		const idDirectory = fstatSync(fileDescriptor).isDirectory();
		if (idDirectory) {
			const subDirs = readdirSync(filePath);
			for (const subdir of subDirs) {
				dirs[subdir] = filePath + "/" + subdir;
			}
		}
	}
	return dirs;
}

export function getDirs(parentDir: string): string[] {
	const dirs: string[] = [];
	const files = readdirSync(parentDir);
	for (const file of files) {
		const filePath = parentDir + file;
		const fileDescriptor = openSync(filePath, "r");
		const idDirectory = fstatSync(fileDescriptor).isDirectory();
		if (idDirectory) {
			dirs.push(filePath);
		}
	}
	return dirs;
}
