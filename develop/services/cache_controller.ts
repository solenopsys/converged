
import { join } from "node:path";
import { brotliCompressData } from "../tools/compress";
import {generateHash} from "../tools/hash";
 import { CacheStore } from "./store";

export class CacheController{
   private cs:CacheStore
 
   constructor(private cacheDir:string ){
      this.cs = new CacheStore(`${cacheDir}/meta.json`);
 this.cs.init();
   }
 


   async saveFile(content: ArrayBuffer | string, type: string, compress: boolean): Promise<string> {
      console.log("SAVE FILE", content);
      
      // Convert content to ArrayBuffer if it's a string
      let contentBuffer!: ArrayBuffer;
      if (typeof content === 'string') {
          const encoder = new TextEncoder();
          const uint8Array = encoder.encode(content);
          contentBuffer = uint8Array.buffer as ArrayBuffer;

      } else {
          contentBuffer = content;
      }
      // Compress if needed
      const toSave = compress ? await brotliCompressData(contentBuffer) : contentBuffer;
      
      // Generate hash and save
      const hash = generateHash(toSave);
      const fullPath = join(this.cacheDir, "store", hash);
      
      await Bun.write(fullPath, toSave);
      await this.cs.setMeta(hash, type, compress);
      
      return hash;
  }

   async saveFromTemp(fileName,type:string,compress:boolean){
      const fullPath = join(this.cacheDir,"temp", fileName);
      const content=  await Bun.file(fullPath).arrayBuffer() ;

      this.saveFile(content,type,compress)
   }

   async  readFile(hash: string):Promise<{buffer:ArrayBuffer,type:string,compressed:boolean}> {
      const fullPath = join(this.cacheDir,"store", hash);

      console.log("read",fullPath)
      const html= await Bun.file(fullPath).arrayBuffer()
      const {type,compressed}= await this.cs.getMeta(hash);
      console.log("read",type,compressed)

      return {buffer:html,type:type,compressed:compressed }
    }

}