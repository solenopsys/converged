import type { 
	JsonObject, 
	FieldHandler,
	SpecialField,
} from "../processor.ts";
import { wrapUri } from "../../tools/urls";
 
 import {join} from "path"
import { CacheController } from "../../services/cache_controller";

export class FileHandler implements FieldHandler {
	constructor(private cc: CacheController,private bsDir:string) {}

	filedName(): string {
		return "@file";
	}

	autoType(fileExt: string): string {
		const map: Record<string, string> = { svg: "svg", png: "png", jpg: "jpg", jpeg: "jpg" };
		return map[fileExt];
	}

	async process(field: SpecialField): Promise<JsonObject> {
		const filePath = field.value as string;
		const content = await Bun.file(join(this.bsDir,filePath)).arrayBuffer();
		const fileExt = filePath.split(".").pop();
		const type = this.autoType(fileExt!);
		const hash = await this.cc.saveFile(content, type, false);

		return    wrapUri(hash);
	}
}

