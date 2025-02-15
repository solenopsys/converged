import { createHash } from "crypto";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";

export async function getDirectoryHash(dirPath: string) {
  const hash = createHash("sha256");
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
}