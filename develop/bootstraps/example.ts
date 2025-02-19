import type {
	JsonValue,
	JsonObject,
	JsonArray,
	FieldHandler,
	SpecialField,
} from "./processor.ts";
import {
	SpecialFieldHandlersRegistry,
	JsonFieldProcessor,
} from "./processor.ts";
import { RemoteHandler } from "./handlers/remote-handler.ts";
import { FileHandler } from "./handlers/file-handler.ts";
import { IncludeHandler } from "./handlers/include-handler.ts";
import { CacheController } from "../services/cache_controller.ts";
import { PackageHandler } from "./handlers/package-handler.ts";
import BuildController from "../services/build_controller.ts";

// Пример использования
async function main() {
	const inputJson =   await Bun.file("./develop/bootstraps/testdata/entry.json").json();

	console.log(JSON.stringify(inputJson,null,2))
	// Создаем и настраиваем registry
	const registry = new SpecialFieldHandlersRegistry();

	const cc = new CacheController("./cache");

	// Создаем основной процессор
	const processor = new JsonFieldProcessor(registry);

	const remoteProcess=(fileName:string)=>{
		const inputJson =   Bun.file(fileName).json();
		const result = processor.process(inputJson);
		return cc.saveFile(JSON.stringify(result),"json",true);
	}

	const  includeProcess=(fileName:string)=>{
		const inputJson =   Bun.file(fileName).json();
		const result = processor.process(inputJson);
		return result;
	}

	const bc=new BuildController("./","./cache");

	// Регистрируем процессоры
	registry.register(new FileHandler(cc));
	registry.register(new IncludeHandler(includeProcess));
	registry.register(new RemoteHandler(remoteProcess));
	registry.register(new PackageHandler(bc));

	// Обрабатываем JSON
	const result = await processor.process(inputJson);
	console.log(JSON.stringify(result, null, 2));
}

// Запуск примера
main().catch(console.error);
