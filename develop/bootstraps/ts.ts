 
const absolutePath = "/home/alexstorm/distrib/hyperconverged/libs/solenopsys/lt-website/src";
 import {getFiles} from "../tools/dirs";


 async function main(){
  const all=await getFiles(absolutePath)
  console.log(all)
 }

 main().catch(console.error);