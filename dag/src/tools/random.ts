export const CharsetPresets = {
	ALPHANUMERIC:
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
	UPPERCASE: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
	LOWERCASE: "abcdefghijklmnopqrstuvwxyz",
	DIGITS: "0123456789",
	HEX: "0123456789ABCDEF",
	SYMBOLS: "!@#$%^&*()_+-=[]{}|;:,.<>?",
	SAFE_SYMBOLS: "-_=+",
	ALL: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?",
};

export class RandomGenerator {
	constructor(
		private length: number = 10,
		private charset: string = CharsetPresets.ALPHANUMERIC,
	) {}

	generate(): string {
		let result = "";
		for (let i = 0; i < this.length; i++) {
			const randomIndex = Math.floor(Math.random() * this.charset.length);
			result += this.charset[randomIndex];
		}
		return result;
	}

	setLength(length: number): void {
		this.length = Math.max(1, length);
	}

	setCharset(charset: string): void {
		if (charset.length > 0) {
			this.charset = charset;
		}
	}

	getLength(): number {
		return this.length;
	}

	getCharset(): string {
		return this.charset;
	}
}
