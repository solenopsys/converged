import type { 
	JsonObject, 
	FieldHandler,
	SpecialField,
} from "../processor.ts";
 
 
import { CacheController } from "../../services/cache_controller.ts";

export class FileHandler implements FieldHandler {
	constructor(private cc: CacheController) {}

	filedName(): string {
		return "@file";
	}

	autoType(fileExt: string): string {
		const map = { svg: "svg", png: "png", jpg: "jpg", jpeg: "jpg" };
		return map[fileExt];
	}

	async process(field: SpecialField): Promise<JsonObject> {
		const filePath = field.value as string;
		const content = await Bun.file(filePath).arrayBuffer();
		const fileExt = filePath.split(".").pop();
		const type = this.autoType(fileExt!);
		const hash = await this.cc.saveFile(content, type, false);

		return { "@hash": hash };
	}
}

