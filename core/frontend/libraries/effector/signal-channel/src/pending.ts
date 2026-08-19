type PendingEntry<T> = {
	resolve: (value: T) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
};


export class PendingMap<T> {
	private entries = new Map<string, PendingEntry<T>>();

	wait(id: string, timeoutMs: number, timeoutError: () => Error): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.entries.delete(id);
				reject(timeoutError());
			}, timeoutMs);
			this.entries.set(id, { resolve, reject, timer });
		});
	}

	has(id: string): boolean {
		return this.entries.has(id);
	}

	resolve(id: string, value: T): void {
		this.take(id)?.resolve(value);
	}

	reject(id: string, error: Error): void {
		this.take(id)?.reject(error);
	}

	rejectAll(error: Error): void {
		for (const entry of this.entries.values()) {
			clearTimeout(entry.timer);
			entry.reject(error);
		}
		this.entries.clear();
	}

	private take(id: string): PendingEntry<T> | undefined {
		const entry = this.entries.get(id);
		if (!entry) return undefined;
		clearTimeout(entry.timer);
		this.entries.delete(id);
		return entry;
	}
}
