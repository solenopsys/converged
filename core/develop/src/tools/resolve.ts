import { join } from "path";
import { PACKAGE } from "../confs.ts";

export async function browserResolvePackage(
	packName: string,
	rootDir: string,
): Promise<string> {
	let packageJson;
	let currName = packName;
	let sub = "";
	try {
		try {
			packageJson = Bun.resolveSync(currName + "/" + PACKAGE, rootDir);
		} catch (e) {
			const fullName = "@" + currName;
			packageJson = Bun.resolveSync(fullName + "/" + PACKAGE, rootDir);

			currName = fullName;
		}
	} catch (e) {
		const parts = packName.split("/");
		currName = parts[0];
		sub = "/" + parts[1];
		packageJson = Bun.resolveSync(currName + "/" + PACKAGE, rootDir);
	}

	console.log(packageJson);
	const jsonString = await Bun.file(packageJson).text();

	const data = JSON.parse(String(jsonString));

	try {
		const imp = data.exports["." + sub].browser.import;
		return join(currName, imp);
	} catch (e) {
		let imp = data.exports["."].default;
		if (!imp) {
			imp = data.exports["."].import;
		}
		return join(currName, imp);
	}
}
