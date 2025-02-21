import { readdirSync, fstatSync, openSync,existsSync } from "node:fs";

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "fs/promises";
import path, { join } from "node:path";
import { promises as fs } from "node:fs";
import { resolve } from 'path';
 

export async function getDirectoryHash(dirPath: string): Promise<string> {
  const hash = createHash("sha256");

  try {
    // Получаем все файлы рекурсивно через Bun.readdir
    const entries = await readdir(dirPath, {
      withFileTypes: true,
      recursive: true,
    });

    // Фильтруем только файлы и сортируем их пути для стабильного хеша
    const filePaths = entries
      .filter((entry) => !entry.isDirectory())
      .map((entry) => entry.parentPath +"/"+ entry.name)
      .sort();

    // Обрабатываем каждый файл
    for (const filePath of filePaths) {
      const content = await readFile(filePath);
      hash.update(content);
      hash.update(filePath); // Добавляем путь для учета структуры
    }

    return hash.digest("hex");
  } catch (error) {
    console.error("Error calculating directory hash:", error);
    throw error;
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
