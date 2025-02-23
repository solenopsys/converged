import type { 
	JsonObject, 
	FieldHandler,
	SpecialField,
} from "../processor.ts";
 

// Дополнительные процессоры можно добавлять здесь
export class IncludeHandler implements FieldHandler {
    

    constructor(private recurseProcess:(fileName:string)=>Promise<JsonObject>){}

	filedName(): string {
		return "@include";
	}

	async process(field: SpecialField): Promise<JsonObject> {
		// Пример обработки URL
		return await this.recurseProcess(field.value as string) ;
	}
}
