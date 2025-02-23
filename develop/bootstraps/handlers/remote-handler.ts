import type { 
	JsonObject, 
	FieldHandler,
	SpecialField,
} from "../processor.js";
 
import { wrapUri } from "../../tools/urls";
// Дополнительные процессоры можно добавлять здесь
export class RemoteHandler implements FieldHandler {
    

    constructor(private recurseProcess:(fileName:string)=>Promise<string>){}

	filedName(): string {
		return "@remote";
	}

	async process(field: SpecialField): Promise<JsonObject> {
		// Пример обработки URL
		return wrapUri(  await this.recurseProcess(field.value as string) );
	}
}
