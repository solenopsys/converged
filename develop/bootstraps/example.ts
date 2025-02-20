 
import { CacheController } from "../services/cache_controller";
import { join } from "path";
import { JsonFieldProcessor } from "./processor";
import BuildController from "develop/services/build_controller";
 
// Пример использования
async function main() {

	const workingDir="./develop/bootstraps/testdata/"; 

	 
	const bc = new BuildController("./","./cache");

	const processor=new JsonFieldProcessor(bc,workingDir);
	const result = await processor.processDir( );
	console.log(JSON.stringify(result, null, 2));

 
}

// Запуск примера
main().catch(console.error);
