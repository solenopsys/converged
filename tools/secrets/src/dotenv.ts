/**
 * A `.env` reader, kept separate from `Bun.env` on purpose.
 *
 * The runtime loader merges a file into the process environment, which is the
 * wrong shape here twice over: this tool must see the file's keys *and only*
 * the file's keys — a Secret built from `process.env` would carry PATH, HOME
 * and whatever the shell happened to export — and it must read a file for an
 * environment it is not itself running in. Parsing is therefore explicit.
 *
 * Ported from the configurator's `env/DotEnv.ts`, narrowed to what generating a
 * Secret needs: the class there also did layered overrides for the dev server,
 * which has no meaning for a one-shot file-to-YAML conversion.
 */

/** `FOO=bar` with the shell's quoting rules, as far as dotenv files use them. */
export function parseDotEnv(content: string): Record<string, string> {
	const env: Record<string, string> = {};

	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
		const eq = normalized.indexOf("=");
		// `<= 0` also rejects a line that opens with `=`, which has no key.
		if (eq <= 0) continue;

		const key = normalized.slice(0, eq).trim();
		// Anything else is not something a shell would export either, and as a
		// Secret key it would be rejected by the apiserver rather than by us.
		if (!/^[a-zA-Z_]\w*$/.test(key)) continue;

		let value = normalized.slice(eq + 1).trim();

		if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
			value = value
				.slice(1, -1)
				.replace(/\\n/g, "\n")
				.replace(/\\r/g, "\r")
				.replace(/\\t/g, "\t")
				.replace(/\\"/g, '"')
				.replace(/\\\\/g, "\\");
		} else if (
			value.startsWith("'") &&
			value.endsWith("'") &&
			value.length >= 2
		) {
			// Single quotes are literal in a shell, so nothing is unescaped here.
			value = value.slice(1, -1);
		} else {
			// Only ` #` starts a trailing comment. A bare `#` does not: it occurs
			// inside unquoted values often enough — URLs with fragments, generated
			// passwords — that treating it as a comment would silently truncate one.
			const comment = value.indexOf(" #");
			if (comment >= 0) value = value.slice(0, comment).trim();
		}

		env[key] = value;
	}

	return env;
}
