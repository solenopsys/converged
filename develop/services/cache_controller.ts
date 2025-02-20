
import { join } from "node:path";
import { brotliCompressData } from "../tools/compress";
import {generateHash} from "../tools/hash";
 import { CacheStore } from "./store";
 import { BunFile } from "bun";

export class CacheController{
   public readonly cs:CacheStore
 
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

  async getImportConf(hash:string){
     const targetHash= await this.cs.getImportConf(hash)
     const jsonData=await (await this.readBunFile(targetHash)).json()
     console.log("getImportConf",jsonData)
      return jsonData
  }

   async saveFromTemp(fileName:string,type:string,compress:boolean){
      const fullPath = join(this.cacheDir,"temp", fileName);
      const content=  await Bun.file(fullPath).arrayBuffer() ;

      this.saveFile(content,type,compress)
   }

   async  readBunFile(hash: string):Promise<BunFile> {
    const fullPath = join(this.cacheDir,"store", hash);

    console.log("read",fullPath)
    return await Bun.file(fullPath) 
     
  }

   async  readFile(hash: string):Promise<{buffer:ArrayBuffer,type:string,compressed:boolean}> {
      const data= await (await this.readBunFile(hash)).arrayBuffer();
      const {type,compressed}= await this.cs.getMeta(hash);
      console.log("read",type,compressed)

      return {buffer:data,type:type,compressed:compressed }
    }

}