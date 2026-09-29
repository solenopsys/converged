export type IpRange = {
	address_family: 4 | 6;
	network_start: string;
	network_end: string;
	prefix_length: number;
};

function parseAddress(input: string): {
	family: 4 | 6;
	value: bigint;
	bits: number;
} {
	let address = input.trim();
	if (address.startsWith("[") && address.endsWith("]")) {
		address = address.slice(1, -1);
	}
	if (!address.includes(":")) {
		const parts = address.split(".");
		if (parts.length !== 4) throw new Error(`Invalid IPv4 address: ${input}`);
		const value = parts.reduce((result, part) => {
			if (
				!/^\d{1,3}$/.test(part) ||
				(part.length > 1 && part.startsWith("0"))
			) {
				throw new Error(`Invalid IPv4 address: ${input}`);
			}
			const octet = Number(part);
			if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
				throw new Error(`Invalid IPv4 address: ${input}`);
			}
			return (result << 8n) | BigInt(octet);
		}, 0n);
		return { family: 4, value, bits: 32 };
	}

	const unzoned = address.split("%")[0];
	if (!unzoned) throw new Error(`Invalid IPv6 address: ${input}`);
	let expanded = unzoned;
	if (expanded.includes(".")) {
		const separator = expanded.lastIndexOf(":");
		const ipv4 = parseAddress(expanded.slice(separator + 1));
		const tail = ipv4.value.toString(16).padStart(8, "0");
		expanded = `${expanded.slice(0, separator + 1)}${tail.slice(0, 4)}:${tail.slice(4)}`;
	}
	const halves = expanded.split("::");
	if (halves.length > 2) throw new Error(`Invalid IPv6 address: ${input}`);
	const left = halves[0] ? halves[0].split(":") : [];
	const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
	const zeroCount = 8 - left.length - right.length;
	if (
		(halves.length === 1 && zeroCount !== 0) ||
		(halves.length === 2 && zeroCount < 1)
	) {
		throw new Error(`Invalid IPv6 address: ${input}`);
	}
	const groups = [
		...left,
		...Array.from({ length: zeroCount }, () => "0"),
		...right,
	];
	const value = groups.reduce((result, group) => {
		if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
			throw new Error(`Invalid IPv6 address: ${input}`);
		}
		const part = Number.parseInt(group, 16);
		if (!Number.isInteger(part) || part < 0 || part > 0xffff) {
			throw new Error(`Invalid IPv6 address: ${input}`);
		}
		return (result << 16n) | BigInt(part);
	}, 0n);
	return { family: 6, value, bits: 128 };
}

export function ipToRange(network: string): IpRange {
	const [address, rawPrefix, extra] = network.trim().split("/");
	if (!address || extra !== undefined)
		throw new Error(`Invalid network: ${network}`);
	const parsed = parseAddress(address);
	if (rawPrefix !== undefined && !/^\d+$/.test(rawPrefix)) {
		throw new Error(`Invalid network prefix: ${network}`);
	}
	const prefix = rawPrefix === undefined ? parsed.bits : Number(rawPrefix);
	if (!Number.isInteger(prefix) || prefix < 0 || prefix > parsed.bits) {
		throw new Error(`Invalid network prefix: ${network}`);
	}
	const hostBits = BigInt(parsed.bits - prefix);
	const mask =
		hostBits === BigInt(parsed.bits)
			? 0n
			: ((1n << BigInt(prefix)) - 1n) << hostBits;
	const start = parsed.value & mask;
	const end = start | ((1n << hostBits) - 1n);
	const width = parsed.bits / 4;
	return {
		address_family: parsed.family,
		network_start: start.toString(16).padStart(width, "0"),
		network_end: end.toString(16).padStart(width, "0"),
		prefix_length: prefix,
	};
}

export function parseIpAddress(
	input: string,
): { family: 4 | 6; hex: string } | undefined {
	try {
		const parsed = parseAddress(input);
		return {
			family: parsed.family,
			hex: parsed.value.toString(16).padStart(parsed.bits / 4, "0"),
		};
	} catch {
		return undefined;
	}
}
