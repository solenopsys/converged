

import { extractConstructorParams } from "./ts-parser";


 


export async function injectInterface(pathToIndexTs:string,pathToOutJsFile:string){
  const indexTsCode = await Bun.file(pathToIndexTs).text();
  console.log(indexTsCode);
  const params = extractConstructorParams(indexTsCode);

  console.log(params);
  
  const jsCode = await Bun.file(pathToOutJsFile).text();
  const codeForInject=`//${JSON.stringify(params)}
  ${jsCode}
  `

 

  await Bun.write(pathToOutJsFile,codeForInject);
}



 