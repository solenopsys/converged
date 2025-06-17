import { connect } from "net";

interface WhoisData {
	domain: string;
	registrar?: string;
	registrationDate?: string;
	expirationDate?: string;
	registrarWhoisServer?: string;
	registrarUrl?: string;
	registrarEmail?: string;
	registrarPhone?: string;
	nameServers?: string[];
	status?: string[];
	raw: {
		primary: Record<string, string>;
		registrar?: Record<string, string>;
	};
}

const WHOIS_SERVERS: Record<string, string> = {
	com: "whois.verisign-grs.com",
	net: "whois.verisign-grs.com",
	org: "whois.pir.org",
	ru: "whois.tcinet.ru",
	uk: "whois.nic.uk",
	de: "whois.denic.de",
};

function getTLD(domain: string): string {
	return domain.split(".").pop()?.toLowerCase() || "";
}

function getWhoisServer(domain: string): string {
	const tld = getTLD(domain);
	return WHOIS_SERVERS[tld] || "whois.iana.org";
}

function queryWhois(domain: string, server: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const socket = connect(43, server);
		let data = "";

		socket.setTimeout(10000);

		socket.on("connect", () => {
			socket.write(`${domain}\r\n`);
		});

		socket.on("data", (chunk) => {
			data += chunk.toString();
		});

		socket.on("end", () => {
			resolve(data);
		});

		socket.on("error", reject);
		socket.on("timeout", () => {
			socket.destroy();
			reject(new Error("Timeout"));
		});
	});
}

function parseToFields(raw: string): Record<string, string> {
	const fields: Record<string, string> = {};
	const lines = raw.split(/\r?\n/);

	for (const line of lines) {
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) continue;

		const key = line.substring(0, colonIndex).trim();
		const value = line.substring(colonIndex + 1).trim();

		if (key && value) {
			fields[key] = value;
		}
	}

	return fields;
}

function extractMainFields(fields: Record<string, string>): Partial<WhoisData> {
	const result: Partial<WhoisData> = {};

	for (const [key, value] of Object.entries(fields)) {
		const keyLower = key.toLowerCase();

		if (keyLower === "registrar") {
			result.registrar = value;
		} else if (keyLower === "creation date" || keyLower === "created") {
			result.registrationDate = value;
		} else if (
			keyLower === "registry expiry date" ||
			keyLower === "expiry date"
		) {
			result.expirationDate = value;
		} else if (keyLower === "registrar whois server") {
			result.registrarWhoisServer = value;
		} else if (keyLower === "registrar url") {
			result.registrarUrl = value;
		} else if (keyLower === "registrar abuse contact email") {
			result.registrarEmail = value;
		} else if (keyLower === "registrar abuse contact phone") {
			result.registrarPhone = value;
		} else if (keyLower === "domain status") {
			if (!result.status) result.status = [];
			result.status.push(value);
		} else if (keyLower === "name server") {
			if (!result.nameServers) result.nameServers = [];
			result.nameServers.push(value);
		}
	}

	return result;
}

export async function whois(domain: string): Promise<WhoisData> {
	const cleanDomain = domain
		.replace(/^https?:\/\//, "")
		.replace(/^www\./, "")
		.split("/")[0];

	const primaryServer = getWhoisServer(cleanDomain);
	const primaryData = await queryWhois(cleanDomain, primaryServer);
	const primaryFields = parseToFields(primaryData);
	const mainFields = extractMainFields(primaryFields);

	const result: WhoisData = {
		domain: cleanDomain,
		...mainFields,
		raw: { primary: primaryFields },
	};

	if (result.registrarWhoisServer) {
		try {
			const registrarData = await queryWhois(
				cleanDomain,
				result.registrarWhoisServer,
			);
			const registrarFields = parseToFields(registrarData);
			const registrarMainFields = extractMainFields(registrarFields);

			result.raw.registrar = registrarFields;

			// Дополняем данными от регистратора
			Object.assign(result, registrarMainFields);
		} catch (error) {
			// Игнорируем ошибки второго запроса
		}
	}

	return result;
}

const data = await whois("ermachining.com");
console.log(JSON.stringify(data, null, 2));
