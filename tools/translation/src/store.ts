/** Content-addressed translation links, persisted one source hash at a time. */

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { hashText, writeJsonAtomic, writeTextAtomic } from "./fs";

export type TranslationRecord = {
	version: 1;
	sourceHash: string;
	translations: Record<string, string[]>;
};

export type StoreVerdict = "ok" | "unrecorded";

function assertHash(hash: string): void {
	if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(`Invalid SHA-256: ${hash}`);
}

export class TranslationStore {
	private cache = new Map<string, TranslationRecord | undefined>();

	constructor(readonly indexRoot: string) {}

	private recordPath(sourceHash: string): string {
		assertHash(sourceHash);
		return join(this.indexRoot, `${sourceHash}.json`);
	}

	read(sourceHash: string): TranslationRecord | undefined {
		if (this.cache.has(sourceHash)) return this.cache.get(sourceHash);
		const path = this.recordPath(sourceHash);
		if (!existsSync(path)) {
			this.cache.set(sourceHash, undefined);
			return undefined;
		}
		const record = JSON.parse(readFileSync(path, "utf8")) as TranslationRecord;
		if (
			record.version !== 1 ||
			record.sourceHash !== sourceHash ||
			!record.translations
		) {
			throw new Error(`Invalid translation index record: ${path}`);
		}
		for (const [locale, links] of Object.entries(record.translations)) {
			if (!Array.isArray(links)) {
				const legacy = links as unknown as { targetHash?: string };
				record.translations[locale] = legacy.targetHash
					? [legacy.targetHash]
					: [];
			}
		}
		this.cache.set(sourceHash, record);
		return record;
	}

	has(sourceHash: string, locale: string, targetHash: string): boolean {
		return (
			this.read(sourceHash)?.translations[locale]?.includes(targetHash) ?? false
		);
	}

	verdict(
		sourceHash: string,
		locale: string,
		targetHash: string,
	): StoreVerdict {
		if (this.has(sourceHash, locale, targetHash)) return "ok";
		return "unrecorded";
	}

	rebuild(records: Iterable<TranslationRecord>): number {
		const next = new Map(
			[...records].map((record) => [record.sourceHash, record]),
		);
		mkdirSync(this.indexRoot, { recursive: true });
		let changed = 0;
		for (const record of next.values()) {
			const path = this.recordPath(record.sourceHash);
			const expected = `${JSON.stringify(record, null, 2)}\n`;
			if (existsSync(path) && readFileSync(path, "utf8") === expected) continue;
			writeJsonAtomic(path, record);
			changed += 1;
		}
		for (const name of readdirSync(this.indexRoot)) {
			if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
			const sourceHash = name.slice(0, -5);
			if (next.has(sourceHash)) continue;
			unlinkSync(join(this.indexRoot, name));
			changed += 1;
		}
		this.cache = new Map(next);
		return changed;
	}

	save(
		sourceHash: string,
		locale: string,
		content: string,
		target: string,
	): string {
		const targetHash = hashText(content);
		writeTextAtomic(target, content);

		const record = this.read(sourceHash) ?? {
			version: 1 as const,
			sourceHash,
			translations: {},
		};
		const links = record.translations[locale] ?? [];
		if (!links.includes(targetHash)) links.push(targetHash);
		record.translations[locale] = links;
		writeJsonAtomic(this.recordPath(sourceHash), record);
		this.cache.set(sourceHash, record);
		return targetHash;
	}
}
