// Типы для JSON
type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];
import BuildController from "../services/build_controller";

import { RemoteHandler } from "./handlers/remote-handler";
import { FileHandler } from "./handlers/file-handler";
import { IncludeHandler } from "./handlers/include-handler";
import { PackageHandler } from "./handlers/package-handler";

// Интерфейсы для обработчиков
interface SpecialField {
	fieldName: string;
	value: JsonValue;
}

interface FieldHandler {
	filedName(): string;
	process(field: SpecialField): Promise<JsonObject>;
}

// Базовые утилиты
const isObject = (value: unknown): value is JsonObject =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const findSpecialField = (obj: JsonObject): SpecialField | null => {
	const entry = Object.entries(obj).find(([key]) => key.startsWith("@"));
	return entry ? { fieldName: entry[0], value: entry[1] } : null;
};

// Процессор полей
class SpecialFieldHandlersRegistry {
	public readonly handlers: Record<string, FieldHandler> = {};

	register(handler: FieldHandler): void {
		this.handlers[handler.filedName()] = handler;
	}

	async processField(field: SpecialField): Promise<JsonObject> {
		//console.log("processField", field);
    
		const processor = this.handlers[field.fieldName];
		if (!processor) {
			throw new Error(`No processor found for field: ${field.fieldName}`);
		}
		return processor.process(field);
	}
}
import { join } from "path";
// Основной процессор JSON
class JsonFieldProcessor {
	processorRegistry:SpecialFieldHandlersRegistry;

	constructor(
		bc: BuildController,
		private bootstrapDir: string,
	) {
		this.processorRegistry = new SpecialFieldHandlersRegistry();

		const remoteProcess = async (fileName: string) => {
			const inputJson = await Bun.file(join(bootstrapDir, fileName)).json();
			const result =await this.process(inputJson);
			return bc.cc.saveFile(JSON.stringify(result), "json", true);
		};

		const includeProcess = async (fileName: string) => {
            //INCLUDE PROCESS
          //  console.log("NCLUDE PROCESS",fileName)
			const inputJson = await Bun.file(join(bootstrapDir, fileName)).json();
         //   console.log("INCLUDE DATA1",inputJson)
			const result =await this.process(inputJson);
          //  console.log("INCLUDE DATA",result)
			return result;
		};

		// Регистрируем процессоры
		this.processorRegistry.register(new FileHandler(bc.cc,bootstrapDir));
		this.processorRegistry.register(new IncludeHandler(includeProcess));
		this.processorRegistry.register(new RemoteHandler(remoteProcess));
		this.processorRegistry.register(new PackageHandler(bc));

       // console.log("HANDLERS",this.processorRegistry.handlers)
	}

	async processDir(): Promise<object>{
		const inputJson = await Bun.file(
			join(this.bootstrapDir, "entry.json"),
		).json();

		const result = await this.process(inputJson);
		return result;
	}

	private async process(jsonObject: any): Promise<JsonObject> {
		const processNode = async (value: JsonValue): Promise<JsonValue> => {
			if (!isObject(value)) {
				return value;
			}

			const result = { ...value };
			const specialField = findSpecialField(value);

			if (specialField) {
				return this.processorRegistry.processField(specialField);
			}

			for (const [key, val] of Object.entries(result)) {
				result[key] = await processNode(val);
			}

			return result;
		};

		return processNode(jsonObject) as Promise<JsonObject>;
	}
}

export type { JsonValue, JsonObject, JsonArray, FieldHandler, SpecialField };
export { SpecialFieldHandlersRegistry, JsonFieldProcessor };
