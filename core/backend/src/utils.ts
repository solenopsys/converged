const KEY_SEPARATOR = ":";
const RANGE_START_SUFFIX = KEY_SEPARATOR;
const RANGE_END_SUFFIX = ";";

export { KEY_SEPARATOR, RANGE_END_SUFFIX, RANGE_START_SUFFIX };

export type ULID = string;

export function generateULID(): ULID {
	const BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

	const time = Date.now();
	let timeStr = "";
	let t = time;
	for (let i = 0; i < 10; i++) {
		timeStr = BASE32[t % 32] + timeStr;
		t = Math.floor(t / 32);
	}

	let randomStr = "";
	for (let i = 0; i < 16; i++) {
		randomStr += BASE32[Math.floor(Math.random() * 32)];
	}

	return timeStr + randomStr;}

export function newULID(): ULID {
	return generateULID();
}

export type ServiceError = Error & {
	statusCode: number;
	code?: string;
	details?: Record<string, unknown>;
};

export function serviceError(
	statusCode: number,
	message: string,
	code?: string,
	details?: Record<string, unknown>,
): ServiceError {
	const error = new Error(message) as ServiceError;
	error.statusCode = statusCode;
	if (code) error.code = code;
	if (details) error.details = details;
	return error;
}

export function notFoundError(
	message: string,
	details?: Record<string, unknown>,
): ServiceError {
	return serviceError(404, message, "NOT_FOUND", details);
}

export function badRequestError(
	message: string,
	details?: Record<string, unknown>,
): ServiceError {
	return serviceError(400, message, "BAD_REQUEST", details);
}

export function conflictError(
	message: string,
	details?: Record<string, unknown>,
): ServiceError {
	return serviceError(409, message, "CONFLICT", details);
}

export function generateUUID(): Uint8Array {
	const uuid = new Uint8Array(16);
	crypto.getRandomValues(uuid);

	uuid[6] = (uuid[6] & 0x0f) | 0x40;	uuid[8] = (uuid[8] & 0x3f) | 0x80;
	return uuid;
}

export function extractCommentParam(code: string) {
	const lines = code.split("\n")[0];
	const strParams = lines.split("//")[1];

	return JSON.parse(strParams);
}

export function timeVersion() {
	return new Date().getTime().toString();
}

export function evaluateJsonPathString(data: any, path: string): any {
	if (!path.startsWith("$.")) {
		return data[path];
	}

	const parts = path.slice(2).split(".");
	let result = data;

	for (const part of parts) {
		if (result === undefined || result === null) {
			return undefined;
		}
		result = result[part];
	}

	return result;
}
