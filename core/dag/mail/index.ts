// dag-mail — the one place a letter is turned into bytes.
//
// Before this, five callers built their own: three copies of a `{{var}}`
// replacer and two hand-written runs of `<p>`. Now a letter is data — a
// template in rp-notify, one entry per language — and this renders it into the
// layout of `HTML email design brief.zip` (converge-magic-link.html): the 600px
// card, the button, the fallback link, the request-meta box, the footer.
//
// No dependencies, on purpose. The same function runs inside the QuickJS VM a
// workflow is evaluated in and inside the UI gateway's Bun process, so it is
// string operations and nothing else: no DOM, no Intl, no effector.
//
// Everything the mock-up had written in as a literal — the brand, the support
// address, the postal address, the language, the link — is a variable here.

/** The languages the surfaces ship; a template is expected to carry all of them. */
export const MAIL_LANGS = ["en", "ru", "de", "es", "fr", "it", "pt"] as const;

/** Last link of the chain recipient → company → this. */
export const FALLBACK_LANG = "en";

/**
 * A line of text. `when` names a variable: an empty one drops the line, which
 * is how a letter says "the console lives at …" only when there is a console.
 * `"!name"` is the other half — the line that stands in when it is empty.
 *
 * Inside the text, `{{var}}` is substituted and `[label](href)` becomes a link
 * (in the text part: `label (href)`). Variables are escaped; the template
 * itself is trusted, because it is a file in the repository.
 */
export type MailLine = string | { text: string; when?: string };

export type MailBlock =
	/** body paragraph */
	| { p: string; when?: string }
	/** smaller grey paragraph */
	| { note: string; when?: string }
	/** the button; `button` is the href, the label is the template's `cta` */
	| { button: string; when?: string }
	/** divider, small caps label, and the same link spelled out */
	| { fallback: string; label: string; when?: string }
	/** the grey box: who asked, and a quieter second line */
	| { meta: string; detail?: string; when?: string }
	| { divider: true; when?: string };

/**
 * One language of one letter. Stored in rp-notify as the JSON string under
 * `content[lang]` — the contract keeps one string per language, and a letter
 * needs more than one.
 */
export type MailContent = {
	subject: string;
	/** the hidden line mail clients show next to the subject */
	preheader?: string;
	heading?: string;
	cta?: string;
	blocks: MailBlock[];
	footer?: MailLine[];
};

/** Structurally a `NotifyTemplate`; parsed or not. */
export type MailTemplate = {
	id: string;
	content: Record<string, string | MailContent>;
};

export type RenderedMail = {
	subject: string;
	html: string;
	text: string;
	/** the language actually used, after fallback */
	lang: string;
};

// ---------------------------------------------------------------------------
// language

function normalizeLang(lang: string | null | undefined): string {
	return String(lang ?? "")
		.trim()
		.toLowerCase()
		.replace(/_/g, "-");
}

/**
 * The first candidate the template can speak, else English, else whatever it
 * has. `pt-BR` matches `pt`. Candidates go most specific first:
 * `pickLang(tpl, [user.lang, company.lang])`.
 */
export function pickLang(
	tpl: MailTemplate,
	candidates: Array<string | null | undefined>,
): string {
	const available = Object.keys(tpl?.content ?? {});
	for (const candidate of [...candidates, FALLBACK_LANG]) {
		const lang = normalizeLang(candidate);
		if (!lang) continue;
		if (available.includes(lang)) return lang;
		const base = lang.split("-")[0];
		if (available.includes(base)) return base;
	}
	if (available.length > 0) return available[0];
	throw new Error(`mail template "${tpl?.id}" has no content in any language`);
}

export function parseMailContent(
	id: string,
	lang: string,
	value: string | MailContent | undefined,
): MailContent {
	if (value === undefined) {
		throw new Error(`mail template "${id}" has no "${lang}" content`);
	}
	let content: MailContent;
	try {
		content = typeof value === "string" ? JSON.parse(value) : value;
	} catch (error: any) {
		throw new Error(
			`mail template "${id}" [${lang}] is not valid JSON: ${error?.message ?? error}`,
		);
	}
	if (!content || typeof content.subject !== "string") {
		throw new Error(`mail template "${id}" [${lang}] has no subject`);
	}
	if (!Array.isArray(content.blocks)) {
		throw new Error(`mail template "${id}" [${lang}] has no blocks`);
	}
	return content;
}

// ---------------------------------------------------------------------------
// text

const VAR_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
const LINK_RE = /\[([^\]]*)\]\(([^)]*)\)/g;

/** The plain `{{var}}` replacer the workflows each used to carry a copy of. */
export function substitute(
	template: string,
	vars: Record<string, string>,
	escape: (value: string) => string = (value) => value,
): string {
	return String(template ?? "").replace(VAR_RE, (_m: string, key: string) =>
		escape(String(vars[key] ?? "")),
	);
}

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

type Mode = "html" | "text";

/** Substitution plus `[label](href)`, for one of the two parts. */
function inline(
	template: string,
	vars: Record<string, string>,
	mode: Mode,
	linkStyle = "",
): string {
	const esc = mode === "html" ? escapeHtml : (value: string) => value;
	let out = "";
	let last = 0;
	for (const match of String(template ?? "").matchAll(LINK_RE)) {
		const at = match.index ?? 0;
		out += substitute(template.slice(last, at), vars, esc);
		const label = substitute(match[1], vars);
		const href = substitute(match[2], vars).trim();
		if (!href) out += esc(label);
		else if (mode === "text")
			out +=
				label && label !== href && label !== href.replace(/^mailto:/, "")
					? `${label} (${href})`
					: label || href;
		else
			out += `<a href="${escapeHtml(href)}"${linkStyle ? ` style="${linkStyle}"` : ""}>${escapeHtml(label || href)}</a>`;
		last = at + match[0].length;
	}
	return out + substitute(template.slice(last), vars, esc);
}

/** `when: "name"` — only if set; `when: "!name"` — only if not. */
function shown(
	entry: { when?: string },
	vars: Record<string, string>,
): boolean {
	if (!entry.when) return true;
	const negated = entry.when.startsWith("!");
	const key = negated ? entry.when.slice(1) : entry.when;
	const set = String(vars[key] ?? "").trim() !== "";
	return negated ? !set : set;
}

function lineOf(line: MailLine): { text: string; when?: string } {
	return typeof line === "string" ? { text: line } : line;
}

// ---------------------------------------------------------------------------
// html — the brief's layout, table-based for Outlook, inline styles for Gmail

const FONT = "font-family:Helvetica,Arial,sans-serif;";
const MONO = "font-family:'Courier New',Courier,monospace;";
const LH = "mso-line-height-rule:exactly;";

const STYLE = `<style>
  @media only screen and (max-width:620px){
    .px{padding-left:24px !important;padding-right:24px !important}
    .h1{font-size:24px !important;line-height:30px !important}
  }
  a{color:#2f6fed}
  @media (prefers-color-scheme:dark){
    .bg{background-color:#09090b !important}
    .card{background-color:#18181b !important;border-color:#27272a !important}
    .fg{color:#fafafa !important}
    .muted{color:#a1a1aa !important}
    .rule{background-color:#27272a !important}
    .box{background-color:#27272a !important;border-color:#3f3f46 !important}
    .btn{background-color:#fafafa !important}
    .btn a{color:#18181b !important}
  }
</style>`;

function row(inner: string, padding: string): string {
	return `<tr><td class="px" style="padding:${padding};">${inner}</td></tr>`;
}

function textRow(
	html: string,
	padding: string,
	size: number,
	lineHeight: number,
	color: string,
	cls: string,
	extra = "",
): string {
	return `<tr><td class="px ${cls}" style="padding:${padding};${FONT}font-size:${size}px;line-height:${lineHeight}px;${LH}color:${color};${extra}">${html}</td></tr>`;
}

function blockHtml(
	block: MailBlock,
	content: MailContent,
	vars: Record<string, string>,
): string {
	if ("p" in block) {
		return textRow(
			inline(block.p, vars, "html"),
			"16px 40px 0 40px",
			15,
			24,
			"#52525b",
			"muted",
		);
	}
	if ("note" in block) {
		return textRow(
			inline(block.note, vars, "html"),
			"20px 40px 0 40px",
			13,
			20,
			"#71717a",
			"muted",
		);
	}
	if ("button" in block) {
		const href = escapeHtml(substitute(block.button, vars).trim());
		const label = escapeHtml(substitute(content.cta ?? "", vars) || href);
		return row(
			`<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
				`<td class="btn" align="center" bgcolor="#18181b" style="border-radius:6px;">` +
				`<a href="${href}" style="display:block;padding:13px 28px;${FONT}font-size:15px;line-height:20px;${LH}color:#fafafa;text-decoration:none;font-weight:600;border-radius:6px;">${label}</a>` +
				`</td></tr></table>`,
			"28px 40px 0 40px",
		);
	}
	if ("fallback" in block) {
		const href = escapeHtml(substitute(block.fallback, vars).trim());
		return (
			dividerHtml() +
			textRow(
				inline(block.label, vars, "html"),
				"24px 40px 0 40px",
				12,
				18,
				"#71717a",
				"muted",
				"letter-spacing:0.3px;text-transform:uppercase;font-weight:600;",
			) +
			`<tr><td class="px" style="padding:8px 40px 0 40px;${MONO}font-size:12px;line-height:20px;${LH}color:#2f6fed;word-break:break-all;">` +
			`<a href="${href}" style="color:#2f6fed;text-decoration:none;">${href}</a></td></tr>`
		);
	}
	if ("meta" in block) {
		const detail = block.detail
			? inline(block.detail, vars, "html").trim()
			: "";
		return row(
			`<table class="box" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fafafa;border:1px solid #e4e4e7;border-radius:8px;"><tr>` +
				`<td class="muted" style="padding:14px 16px;${FONT}font-size:13px;line-height:20px;${LH}color:#52525b;">` +
				inline(
					block.meta,
					vars,
					"html",
					`${MONO}color:#18181b;text-decoration:none;`,
				) +
				(detail ? `<br><span style="color:#71717a;">${detail}</span>` : "") +
				`</td></tr></table>`,
			"28px 40px 0 40px",
		);
	}
	return dividerHtml();
}

function dividerHtml(): string {
	return row(
		`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>` +
			`<td class="rule" height="1" style="height:1px;background-color:#e4e4e7;line-height:1px;font-size:0;">&nbsp;</td>` +
			`</tr></table>`,
		"28px 40px 0 40px",
	);
}

function renderHtml(
	content: MailContent,
	lang: string,
	vars: Record<string, string>,
): string {
	const blocks = content.blocks.filter((block) => shown(block, vars));
	const footer = (content.footer ?? [])
		.map(lineOf)
		.filter((line) => shown(line, vars))
		.map((line) =>
			inline(
				line.text,
				vars,
				"html",
				"color:#8b8b93;text-decoration:underline;",
			),
		)
		.filter((line) => line.trim() !== "");
	const brand = escapeHtml(vars.brand ?? "");
	const subject = escapeHtml(substitute(content.subject, vars));
	const preheader = content.preheader
		? escapeHtml(substitute(content.preheader, vars))
		: "";

	const body: string[] = [];
	if (content.heading) {
		body.push(
			`<tr><td class="px" style="padding:40px 40px 0 40px;${FONT}">` +
				`<div class="h1 fg" style="font-size:28px;line-height:34px;${LH}color:#18181b;font-weight:600;letter-spacing:-0.6px;">` +
				`${inline(content.heading, vars, "html")}</div></td></tr>`,
		);
	}
	blocks.forEach((block, index) => {
		let html = blockHtml(block, content, vars);
		// Without a heading the first block opens the card, and takes its top padding.
		if (index === 0 && !content.heading)
			html = html.replace(
				/padding:\d+px 40px 0 40px/,
				"padding:40px 40px 0 40px",
			);
		body.push(html);
	});
	// The card's bottom padding, as its own row so the last block can be anything.
	body.push(
		`<tr><td style="height:40px;line-height:40px;font-size:0;">&nbsp;</td></tr>`,
	);

	return [
		"<!DOCTYPE html>",
		`<html lang="${escapeHtml(lang)}">`,
		"<head>",
		'<meta charset="utf-8">',
		'<meta name="viewport" content="width=device-width, initial-scale=1">',
		'<meta name="color-scheme" content="light dark">',
		'<meta name="supported-color-schemes" content="light dark">',
		`<title>${subject}</title>`,
		"<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->",
		STYLE,
		"</head>",
		'<body class="bg" style="margin:0;padding:0;background-color:#f4f4f5;">',
		preheader
			? `<span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>`
			: "",
		'<table class="bg" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f5;"><tr><td align="center" style="padding:40px 12px;">',
		'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">',
		brand
			? `<tr><td class="px muted" style="padding:0 40px 20px 40px;${FONT}font-size:15px;line-height:20px;${LH}color:#52525b;font-weight:600;letter-spacing:-0.2px;">${brand}</td></tr>`
			: "",
		'<tr><td class="card" style="background-color:#ffffff;border:1px solid #e4e4e7;border-radius:8px;">',
		'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">',
		...body,
		"</table>",
		"</td></tr>",
		footer.length
			? `<tr><td class="px muted" style="padding:24px 40px 0 40px;${FONT}font-size:12px;line-height:20px;${LH}color:#8b8b93;">${footer.join("<br>")}</td></tr>`
			: "",
		"</table>",
		"</td></tr></table>",
		"</body>",
		"</html>",
	]
		.filter(Boolean)
		.join("\n");
}

// ---------------------------------------------------------------------------
// text — the alternative part, built from the same data rather than stripped
// out of the html

function renderText(
	content: MailContent,
	vars: Record<string, string>,
): string {
	const parts: string[] = [];
	if (content.heading) parts.push(inline(content.heading, vars, "text"));

	let linked = "";
	for (const block of content.blocks) {
		if (!shown(block, vars)) continue;
		if ("p" in block) parts.push(inline(block.p, vars, "text"));
		else if ("note" in block) parts.push(inline(block.note, vars, "text"));
		else if ("button" in block) {
			linked = substitute(block.button, vars).trim();
			const label = substitute(content.cta ?? "", vars);
			parts.push(label ? `${label}:\n${linked}` : linked);
		} else if ("fallback" in block) {
			// The text part has no button to fail; the link is already spelled out.
			const href = substitute(block.fallback, vars).trim();
			if (href !== linked)
				parts.push(`${inline(block.label, vars, "text")}:\n${href}`);
		} else if ("meta" in block) {
			const detail = block.detail
				? inline(block.detail, vars, "text").trim()
				: "";
			parts.push(
				[inline(block.meta, vars, "text"), detail].filter(Boolean).join("\n"),
			);
		} else parts.push("---");
	}

	const footer = (content.footer ?? [])
		.map(lineOf)
		.filter((line) => shown(line, vars))
		.map((line) => inline(line.text, vars, "text"))
		.filter((line) => line.trim() !== "");
	if (footer.length) parts.push(`--\n${footer.join("\n")}`);

	return parts
		.map((part) => part.trim())
		.filter(Boolean)
		.join("\n\n");
}

// ---------------------------------------------------------------------------

/**
 * One letter in one language. `lang` falls back through `pickLang`, so a
 * caller hands in the recipient's language as it is and does not check the
 * template first. A template with nothing to render throws — an empty letter
 * leaving quietly is the failure this layer exists to prevent.
 *
 * `brand` is the one variable the layout itself reads (the line above the
 * card); every other name belongs to the template.
 */
export function renderMail(
	tpl: MailTemplate,
	lang: string,
	vars: Record<string, string>,
): RenderedMail {
	if (!tpl?.content) throw new Error("mail template is missing");
	const used = pickLang(tpl, [lang]);
	const content = parseMailContent(tpl.id, used, tpl.content[used]);
	const all: Record<string, string> = { ...vars, lang: used };
	const subject = substitute(content.subject, all).replace(/\s+/g, " ").trim();
	if (!subject)
		throw new Error(
			`mail template "${tpl.id}" [${used}] renders an empty subject`,
		);
	return {
		subject,
		html: renderHtml(content, used, all),
		text: renderText(content, all),
		lang: used,
	};
}
