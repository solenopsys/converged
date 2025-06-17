import { connect as tlsConnect } from "tls";
import { resolveMx } from "dns/promises";

class SMTPChecker {
	private timeout: number;

	constructor(timeout = 10000) {
		this.timeout = timeout;
	}

	private async getMxHost(domain: string): Promise<string> {
		try {
			const records = await resolveMx(domain);
			return (
				records.sort((a, b) => a.priority - b.priority)[0]?.exchange || domain
			);
		} catch {
			return domain;
		}
	}

	private sendCommand(socket: any, command: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new Error("Timeout")),
				this.timeout,
			);

			socket.once("data", (data: Buffer) => {
				clearTimeout(timer);
				resolve(data.toString().trim());
			});

			socket.write(command + "\r\n");
		});
	}

	async check(email: string): Promise<boolean> {
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return false;
		}

		const domain = email.split("@")[1];
		const mxHost = await this.getMxHost(domain);

		return new Promise((resolve) => {
			// Создаем TLS соединение сразу на порт 465 (SMTPS)
			const socket = tlsConnect({
				host: mxHost,
				port: 465,
				rejectUnauthorized: false,
			});

			socket.setTimeout(this.timeout);

			socket.on("secureConnect", async () => {
				try {
					// Ждем приветствие сервера
					const welcome = await new Promise<string>((res, rej) => {
						const timer = setTimeout(() => rej(new Error("No welcome")), 5000);
						socket.once("data", (data: Buffer) => {
							clearTimeout(timer);
							res(data.toString().trim());
						});
					});

					if (!welcome.startsWith("220")) {
						socket.end();
						resolve(false);
						return;
					}

					// EHLO
					const ehlo = await this.sendCommand(socket, `EHLO ${domain}`);
					if (!ehlo.startsWith("250")) {
						socket.end();
						resolve(false);
						return;
					}

					// MAIL FROM
					const mailFrom = await this.sendCommand(
						socket,
						"MAIL FROM:<noreply@example.com>",
					);
					if (!mailFrom.startsWith("250")) {
						socket.end();
						resolve(false);
						return;
					}

					// RCPT TO - главная проверка
					const rcptTo = await this.sendCommand(socket, `RCPT TO:<${email}>`);

					// QUIT
					await this.sendCommand(socket, "QUIT");
					socket.end();

					// Проверяем ответ
					const code = parseInt(rcptTo.substring(0, 3));
					resolve(code === 250 || code === 251);
				} catch (error) {
					socket.end();
					resolve(false);
				}
			});

			socket.on("error", () => {
				resolve(false);
			});

			socket.on("timeout", () => {
				socket.destroy();
				resolve(false);
			});
		});
	}

	async checkBatch(emails: string[]): Promise<Record<string, boolean>> {
		const results: Record<string, boolean> = {};

		// Проверяем по одному чтобы не забанили
		for (const email of emails) {
			results[email] = await this.check(email);
			// Небольшая пауза между запросами
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		return results;
	}
}

// Fallback на STARTTLS если прямой TLS не работает
class SMTPCheckerSTARTTLS extends SMTPChecker {
	async check(email: string): Promise<boolean> {
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return false;
		}

		const domain = email.split("@")[1];
		const mxHost = await this.getMxHost(domain);

		return new Promise((resolve) => {
			const { connect } = require("net");
			const socket = connect(25, mxHost);

			socket.setTimeout(this.timeout);

			socket.on("connect", async () => {
				try {
					// Приветствие
					const welcome = await new Promise<string>((res, rej) => {
						const timer = setTimeout(() => rej(new Error("No welcome")), 5000);
						socket.once("data", (data: Buffer) => {
							clearTimeout(timer);
							res(data.toString().trim());
						});
					});

					if (!welcome.startsWith("220")) {
						socket.end();
						resolve(false);
						return;
					}

					// EHLO
					const ehlo = await this.sendCommand(socket, `EHLO ${domain}`);
					if (!ehlo.startsWith("250")) {
						socket.end();
						resolve(false);
						return;
					}

					// STARTTLS если поддерживается
					if (ehlo.includes("STARTTLS")) {
						const starttls = await this.sendCommand(socket, "STARTTLS");
						if (starttls.startsWith("220")) {
							// Переключаемся на TLS
							const { TLSSocket } = require("tls");
							const tlsSocket = new TLSSocket(socket, {
								rejectUnauthorized: false,
							});

							// Продолжаем с TLS сокетом
							const ehlo2 = await this.sendCommand(tlsSocket, `EHLO ${domain}`);
							if (!ehlo2.startsWith("250")) {
								tlsSocket.end();
								resolve(false);
								return;
							}

							const mailFrom = await this.sendCommand(
								tlsSocket,
								"MAIL FROM:<noreply@example.com>",
							);
							if (!mailFrom.startsWith("250")) {
								tlsSocket.end();
								resolve(false);
								return;
							}

							const rcptTo = await this.sendCommand(
								tlsSocket,
								`RCPT TO:<${email}>`,
							);
							await this.sendCommand(tlsSocket, "QUIT");
							tlsSocket.end();

							const code = parseInt(rcptTo.substring(0, 3));
							resolve(code === 250 || code === 251);
							return;
						}
					}

					// Если TLS не поддерживается, продолжаем без шифрования
					const mailFrom = await this.sendCommand(
						socket,
						"MAIL FROM:<noreply@example.com>",
					);
					if (!mailFrom.startsWith("250")) {
						socket.end();
						resolve(false);
						return;
					}

					const rcptTo = await this.sendCommand(socket, `RCPT TO:<${email}>`);
					await this.sendCommand(socket, "QUIT");
					socket.end();

					const code = parseInt(rcptTo.substring(0, 3));
					resolve(code === 250 || code === 251);
				} catch (error) {
					socket.end();
					resolve(false);
				}
			});

			socket.on("error", () => resolve(false));
			socket.on("timeout", () => {
				socket.destroy();
				resolve(false);
			});
		});
	}
}

// Usage
if (import.meta.main) {
	const emails = process.argv.slice(2);

	if (emails.length === 0) {
		console.log("Usage: bun smtp-checker.ts <email1> [email2] ...");
		process.exit(1);
	}

	const checker = new SMTPChecker();
	const fallbackChecker = new SMTPCheckerSTARTTLS();

	console.log("Checking emails with TLS...");

	for (const email of emails) {
		try {
			let result = await checker.check(email);

			// Если TLS не сработал, пробуем STARTTLS
			if (!result) {
				console.log(`TLS failed for ${email}, trying STARTTLS...`);
				result = await fallbackChecker.check(email);
			}

			console.log(`${email}: ${result ? "✅ exists" : "❌ not found"}`);
		} catch (error) {
			console.log(`${email}: ❌ error - ${error}`);
		}
	}
}

export { SMTPChecker, SMTPCheckerSTARTTLS };
