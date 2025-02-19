import type { 
	JsonObject, 
	FieldHandler,
	SpecialField,
} from "../processor.ts";


import BuildController from "../../services/build_controller";

export class PackageHandler implements FieldHandler {
    constructor(private bc:BuildController){}

	filedName(): string {
		return "@package";
	}

	async process(field: SpecialField): Promise<JsonObject> {
        const packName = field.value as string;
        const hash= await this.bc.runBuildTaskPack(packName);
		return { "@hash": hash};
	}
}

 