import { readdirSync, fstatSync, openSync,existsSync } from "node:fs";

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "fs/promises";
import path, { join } from "node:path";
import { promises as fs } from "node:fs";
import { resolve } from 'path';

async function isDirectory(path: string): Promise<boolean> {
	try { 
	  const stats = await fs.lstat(path);
	  return stats.isDirectory();
	} catch {
	  return false;
	}
  }


export async function getFiles(dirPath: string): Promise<string[]> {
	try {
 
		console.log("dirPath",dirPath)
	  const entries = await readdir(dirPath, { withFileTypes: true ,recursive:true });
	  return entries
		.filter(entry => !entry.isDirectory())
		.map(entry => path.join(entry.parentPath, entry.name));
	} catch (error) {
	  console.error(`Error reading directory ${dirPath}:`, error);
	  throw error;
	}
  }

export async function getDirectoryHash(dirPath: string): Promise<string> {
	const hash = createHash("sha256");
  
	try { 
	  // Получаем список всех файлов в директории и поддиректориях
	  const files = await getFiles(dirPath);

	  console.log("files",files)
  
	  // Сортируем файлы для получения стабильного хеша
	  for (const relativePath of files.sort()) {
		const fullPath = join(dirPath, relativePath);
		 
		// Обрабатываем только файлы, пропускаем директории
		if (await isDirectory(fullPath)) {
		  const content = await readFile(fullPath);
		  hash.update(content);
		  
		  // Добавляем путь к файлу в хеш, чтобы учитывать структуру директории
		  hash.update(relativePath);
		}
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
