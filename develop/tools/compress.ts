import { brotliCompressSync, brotliDecompressSync } from "node:zlib";

export   async function brotliCompressData(content: ArrayBuffer):Promise<ArrayBuffer> {
   const startTime = performance.now();
   const inputSize = content.byteLength;
   
   const compressed = brotliCompressSync(new Uint8Array(content));
   const outputSize = compressed.byteLength;
   
   
   
   const endTime = performance.now();
   const compressionTime = endTime - startTime;
   
   const comp=`${(inputSize / 1024).toFixed(2)}->${(outputSize / 1024).toFixed(2)} KB`
   const ratio=` (${(outputSize / inputSize * 100).toFixed(1)}%)`;
   const time=` ${compressionTime.toFixed(2)} ms`;
   console.log(`Compress: ${comp} ${ratio} ${time}`);
 
   return new Uint8Array(compressed).buffer;
}

 

export async function brotliCompressFile(filePath: string): Promise<void> {
	try {
	
		 
		 const file = Bun.file(filePath);
		 const content = await file.arrayBuffer();

       const compressed=await brotliCompressData(content);

       console.log(`Compression completed successfully:${filePath}`);
       await Bun.write(filePath, compressed);
	} catch (err) {
		 console.error('An error occurred:', err);
		 throw err;
	}
}