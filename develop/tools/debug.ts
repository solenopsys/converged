 

import { join } from "node:path";
import {generateHash} from "./hash"

export async function fixDebugId(
	dir: string,
	scriptFileName: string,
	mapFileName: string,
) {
	const fullPathJs = join(dir, scriptFileName);
	const fullPathMap = join(dir, mapFileName);

	// Читаем map файл с явным указанием utf-8 кодировки
	const mapContent = await Bun.file(fullPathMap).text();
 

	try {
		const jsonMap = JSON.parse(mapContent);

      const debugId = jsonMap.debugId;

      // Читаем js файл
      const fullFileContent = await Bun.file(fullPathJs).text();
      const fileContent = fullFileContent.split("//# debugId=")[0];
      const newDebugId = generateHash(Buffer.from(fileContent));
      const newFileContent = fullFileContent.replace(debugId, newDebugId);
   
      // Обновляем debugId
      jsonMap.debugId = newDebugId;

      try {
         // Сохраняем map файл
         await Bun.write(fullPathMap, JSON.stringify(jsonMap, null, 2));
   
         // Сохраняем js файл
         await Bun.write(fullPathJs, newFileContent);
      } catch (error) {
         console.error("Ошибка сохранения файлов:", error);
         throw error;
      }
	} catch (error) {
		console.error("Ошибка парсинга JSON:", error);
		throw error;
	}




}