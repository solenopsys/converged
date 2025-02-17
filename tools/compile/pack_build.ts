import lightningcssPlugin from "./lightningcss-plugin.ts";


export async function bindleLibrary(
   libName: string,
   unicId: string,
    entryPoint: string,
    outPutPath:string,
    external:string[]
   ) {

 const prefix=libName +"." +unicId;
   const outNameJS= prefix+ ".js";

   
    console.log("EXTERNAL",external);  
   const out: any = await Bun.build({
      sourcemap: "external",
      entrypoints: [entryPoint],
      target: "browser",
      outdir: outPutPath,
      naming: {
         entry:outNameJS, //this problem
      },
      minify: true,
      external,
      plugins: [lightningcssPlugin()],
   }).catch((e) => {
      console.log("ERROR BUILD", e);
   });



   
   return {script:outNameJS,map:outNameJS+".map"}
}

 
