import { extname } from "node:path";

export type DetectedFileType =
	| "zip"
	| "step"
	| "stl"
	| "obj"
	| "ply"
	| "3mf"
	| "glb"
	| "gltf"
	| "gcode"
	| "dxf"
	| "pdf"
	| "image"
	| "text"
	| "unknown";

export type FileDetection = {
	type: DetectedFileType;
	extension: string;
	mime: string;
	isArchive: boolean;
	isModel: boolean;
	isPreview: boolean;
};

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
	if (bytes.length < signature.length) return false;
	return signature.every((value, index) => bytes[index] === value);
}

function looksLikeText(bytes: Uint8Array): boolean {
	const sample = bytes.slice(0, Math.min(bytes.length, 512));
	if (sample.length === 0) return true;
	let printable = 0;

	for (const byte of sample) {
		if (
			byte === 9 ||
			byte === 10 ||
			byte === 13 ||
			(byte >= 32 && byte <= 126)
		) {
			printable++;
		}
	}

	return printable / sample.length > 0.9;
}

function textPrefix(bytes: Uint8Array): string {
	return new TextDecoder()
		.decode(bytes.slice(0, Math.min(bytes.length, 256)))
		.trimStart()
		.toLowerCase();
}

export function contentTypeForName(
	name: string,
	fallback = "application/octet-stream",
): string {
	const extension = extname(name).toLowerCase();
	switch (extension) {
		case ".zip":
			return "application/zip";
		case ".step":
		case ".stp":
			return "model/step";
		case ".stl":
			return "model/stl";
		case ".obj":
			return "model/obj";
		case ".ply":
			return "model/ply";
		case ".3mf":
			return "model/3mf";
		case ".glb":
			return "model/gltf-binary";
		case ".gltf":
			return "model/gltf+json";
		case ".gcode":
		case ".nc":
		case ".tap":
			return "text/x-gcode";
		case ".dxf":
			return "image/vnd.dxf";
		case ".pdf":
			return "application/pdf";
		case ".json":
			return "application/json";
		case ".txt":
			return "text/plain";
		default:
			return fallback;
	}
}

export function detectFileType(name: string, bytes: Uint8Array): FileDetection {
	const extension = extname(name).toLowerCase();
	const prefix = textPrefix(bytes);

	let type: DetectedFileType = "unknown";

	if (extension === ".3mf") {
		type = "3mf";
	} else if (
		startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
		extension === ".zip"
	) {
		type = "zip";
	} else if (
		startsWith(bytes, [0x67, 0x6c, 0x54, 0x46]) ||
		extension === ".glb"
	) {
		type = "glb";
	} else if (
		startsWith(bytes, [0x25, 0x50, 0x44, 0x46]) ||
		extension === ".pdf"
	) {
		type = "pdf";
	} else if (
		extension === ".step" ||
		extension === ".stp" ||
		prefix.includes("iso-10303-21")
	) {
		type = "step";
	} else if (extension === ".stl" || prefix.startsWith("solid ")) {
		type = "stl";
	} else if (extension === ".obj") {
		type = "obj";
	} else if (extension === ".ply" || prefix.startsWith("ply")) {
		type = "ply";
	} else if (extension === ".gltf") {
		type = "gltf";
	} else if ([".gcode", ".nc", ".tap"].includes(extension)) {
		type = "gcode";
	} else if (extension === ".dxf") {
		type = "dxf";
	} else if ([".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
		type = "image";
	} else if (looksLikeText(bytes)) {
		type = "text";
	}

	return {
		type,
		extension,
		mime: contentTypeForName(name),
		isArchive: type === "zip",
		isModel: ["step", "stl", "obj", "ply", "3mf", "glb", "gltf"].includes(type),
		isPreview: type === "glb" || type === "gltf",
	};
}
