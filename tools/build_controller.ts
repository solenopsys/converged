import CacheStore from "./db.ts";
import WorkersService from "./worker_serivice.ts";
import { createHash } from "crypto";
import { join } from "path";
import { rename } from "fs/promises";
import { getDirectoryHash } from "./dir_hash.ts";


function generateSha256Hash(content: Buffer) {
   return createHash('sha256').update(content).digest('hex');
 }

 export async function fixDebugId(dir: string, scriptFileName: string, mapFileName: string) {
   const fullPathJs = join(dir, scriptFileName);
   const fullPathMap = join(dir, mapFileName);

   // Читаем map файл с явным указанием utf-8 кодировки
   const mapContent = await Bun.file(fullPathMap).text();
   let jsonMap;
   
   try {
     jsonMap = JSON.parse(mapContent);
   } catch (error) {
     console.error('Ошибка парсинга JSON:', error);
     throw error;
   }
   
   const debugId = jsonMap.debugId;

   // Читаем js файл
   const fullFileContent = await Bun.file(fullPathJs).text();
   const fileContent = fullFileContent.split("//# debugId=")[0];
   const newDebugId = generateSha256Hash(Buffer.from(fileContent));
   const newFileContent = fullFileContent.replace(debugId, newDebugId);

   // Обновляем debugId
   jsonMap.debugId = newDebugId;

   try {
     // Сохраняем map файл
     await Bun.write(
       fullPathMap, 
       JSON.stringify(jsonMap, null, 2)
     );

     // Сохраняем js файл
     await Bun.write(fullPathJs, newFileContent);
   } catch (error) {
     console.error('Ошибка сохранения файлов:', error);
     throw error;
   }
}

 
 export async function hashRename(dir: string, scriptFileName: string,mapFileName:string) {
   try {
     const fullPathJs = join(dir, scriptFileName);
     const fullPathMap = join(dir, mapFileName);
     const fileContent = await Bun.file(fullPathJs).arrayBuffer();
     const hash = generateSha256Hash(Buffer.from(fileContent));
     const jsName = join(dir, `../libraries/${hash}.js`);
     const jsMapName = join(dir, `../sourcemaps/${hash}.js.map`);
     await rename(fullPathJs,jsName) ;
     await rename(fullPathMap,jsMapName) ;
     return hash
   } catch (error) {
     console.error("Error renaming file:", error);
     throw error;
   }
 }

export default class BuildController {
   public readonly  ws: WorkersService;
   private cs: CacheStore;

   constructor (
      private rootDir: string,
      private cacheDir: string,
   ) {
      this.cs = new CacheStore(`${cacheDir}/meta.json`);
      const buildWorker = new Worker("./tools/compile/workers/build.ts");
      this.ws = new WorkersService(buildWorker);
   }

   async init() {
      await this.cs.init();
   }


   async runBuildTask(packDir: string): Promise<any> {
      const targetDir =this.rootDir + packDir;
      const srcDir = targetDir + "/src";
      const result = await this.ws.runBuildTask( targetDir);
      console.log('Build completed:', result);

      if (result.success) {
         const { script, map } = result;
         const tempPath=this.cacheDir+"/temp/"
         await fixDebugId(tempPath, script,map)
         const libHash=await hashRename(tempPath, script,map);
         
         const dirHash= await getDirectoryHash(srcDir);
         this.cs.setHashDir(dirHash,libHash);
      }
      return result;
   }

   async terminate() {
      this.ws.terminate();
   }
}