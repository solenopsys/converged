import { relative } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { dist } from "./layout";

/** Пофайловые размеры поставки: их же читает проверка бюджетов (PLAN.md §7). */

export type SizedFile = { file: string; raw: number; gzip: number; brotli: number };
export type Measured = Awaited<ReturnType<typeof measure>>;

export async function measure(paths: string[]) {
	const files: SizedFile[] = await Promise.all(
		paths.map(async (path) => ({
			file: relative(dist, path),
			...(await fileSize(path)),
		})),
	);
	const total = files.reduce(
		(sum, file) => ({
			raw: sum.raw + file.raw,
			gzip: sum.gzip + file.gzip,
			brotli: sum.brotli + file.brotli,
		}),
		{ raw: 0, gzip: 0, brotli: 0 },
	);
	return { files, total };
}

export function sizeRows({ files, total }: Measured) {
	const row = (file: string, size: { raw: number; brotli: number }) => ({
		file,
		raw: humanSize(size.raw),
		brotli: humanSize(size.brotli),
	});
	const rows = [...files]
		.sort((left, right) => right.raw - left.raw)
		.map((file) => row(file.file, file));
	return files.length > 1 ? [...rows, row("total", total)] : rows;
}

/** Отчёт читают глазами: килобайты с одним знаком, байты в JSON-отчёте. */
export function humanSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const kilobytes = bytes / 1024;
	if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
	return `${(kilobytes / 1024).toFixed(2)} MB`;
}

async function fileSize(path: string) {
	const bytes = Buffer.from(await Bun.file(path).arrayBuffer());
	return {
		raw: bytes.byteLength,
		gzip: gzipSync(bytes).byteLength,
		brotli: brotliCompressSync(bytes).byteLength,
	};
}

export async function precompress(paths: string[]): Promise<void> {
	await Promise.all(
		paths.map(async (path) => {
			const source = await Bun.file(path).arrayBuffer();
			await Bun.write(`${path}.br`, brotliCompressSync(Buffer.from(source)));
		}),
	);
}
