import type { 
	JsonObject, 
	FieldHandler,
	SpecialField,
} from "../processor.js";

import BuildController from "../../services/build_controller.js";

// Дополнительные процессоры можно добавлять здесь
export class RemoteHandler implements FieldHandler {
    

    constructor(private recurseProcess:(fileName:string)=>Promise<string>){}

	filedName(): string {
		return "@include";
	}

	async process(field: SpecialField): Promise<JsonObject> {
		// Пример обработки URL
		return { "@hash": await this.recurseProcess(field.value as string) };
	}
}
