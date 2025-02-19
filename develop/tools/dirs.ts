import { readdirSync, fstatSync, openSync,existsSync } from "node:fs";

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export async function getDirectoryHash(dirPath: string) {
  const hash = createHash("sha256");

  try {
	const files = await readdir(dirPath, { recursive: true });
	for (const file of files.sort()) {
		const fullPath = join(dirPath, file);
		const stats = await stat(fullPath);
		
		if (stats.isFile()) {  // Проверяем, что это файл, а не директория
		  const content = await readFile(fullPath);
		  hash.update(content);
		}
	  }
	  
	  return hash.digest("hex");
  } catch( e ){
    console.error(e)
	throw e
  }
 
  
 
}

export function extractBootstrapsDirs(rootDir: string): {
	[name: string]: string;
} {
	const dirs: { [name: string]: string } = {};
	const dir =  `${rootDir}/bootstraps`;
	// Добавлена проверка на существование директории
    if (!existsSync(dir)) {
        console.error(`Directory not found: ${dir}`);
        return dirs;
    }
	const files = readdirSync(dir);
	console.log(files);
	for (const file of files) {
		const filePath =  join(dir,file);
		const fileDescriptor = openSync(filePath, "r");
		const idDirectory = fstatSync(fileDescriptor).isDirectory();
		if (idDirectory) {
			const subDirs = readdirSync(filePath);
			for (const subdir of subDirs) {
				dirs[subdir] =  join(filePath,subdir );
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
