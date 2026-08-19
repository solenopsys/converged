type Waiter<T> = {
	resolve: (value: IteratorResult<T>) => void;
	reject: (error: Error) => void;
};


export class StreamQueue<T> implements AsyncIterableIterator<T> {
	private values: T[] = [];
	private waiters: Waiter<T>[] = [];
	private done = false;
	private error: Error | undefined;

	constructor(private readonly onCancel: () => void) {}

	push(value: T): void {
		const waiter = this.waiters.shift();
		if (waiter) waiter.resolve({ value, done: false });
		else this.values.push(value);
	}

	finish(): void {
		this.done = true;
		for (const waiter of this.waiters.splice(0)) {
			waiter.resolve({ value: undefined, done: true });
		}
	}

	fail(error: Error): void {
		this.error = error;
		for (const waiter of this.waiters.splice(0)) waiter.reject(error);
	}

	async next(): Promise<IteratorResult<T>> {
		if (this.error) throw this.error;
		const value = this.values.shift();
		if (value !== undefined) return { value, done: false };
		if (this.done) return { value: undefined, done: true };
		return new Promise((resolve, reject) =>
			this.waiters.push({ resolve, reject }),
		);
	}

	async return(): Promise<IteratorResult<T>> {
		this.onCancel();
		this.finish();
		return { value: undefined, done: true };
	}

	[Symbol.asyncIterator](): AsyncIterableIterator<T> {
		return this;
	}
}
