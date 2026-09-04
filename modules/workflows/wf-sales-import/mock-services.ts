// Mock rp-files / rp-sales universe for the wf-sales-import tests (test-only,
// never bundled into a workflow). The parsers themselves are the service's job
// and are tested there; this mock stands in for them with a small delimited
// reader so the workflow's branches can be exercised.

export type ImportUniverse = {
	/** fileId -> { name, text } */
	filesById: Map<string, { name: string; text: string }>;
	/** the parse result sales.parseImportLeads should answer with */
	parsed: { leads: any[]; format: string };
	leads: any[];
	contacts: any[];
	tags: { leadId: string; tag: string }[];
	/** ids that already exist — adding them again answers with a conflict */
	existing: Set<string>;
	calls: string[];

	addFile(fileId: string, name: string, text: string): void;
	setParsed(leads: any[], format?: string): void;
	failOn(service: string, method: string, message: string): void;
	handler(
		service: string,
		method: string,
		params: any,
		cache: Map<string, string>,
	): unknown;
};

export function createImportUniverse(): ImportUniverse {
	const failures = new Map<string, string>();

	const u: ImportUniverse = {
		filesById: new Map(),
		parsed: { leads: [], format: "none" },
		leads: [],
		contacts: [],
		tags: [],
		existing: new Set(),
		calls: [],

		addFile(fileId, name, text) {
			u.filesById.set(fileId, { name, text });
		},

		setParsed(leads, format = "delimited") {
			u.parsed = { leads, format };
		},

		failOn(service, method, message) {
			failures.set(`${service}.${method}`, message);
		},

		handler(service, method, params, cache) {
			const key = `${service}.${method}`;
			u.calls.push(key);
			const failure = failures.get(key);
			if (failure) throw new Error(failure);

			switch (key) {
				case "files.materialize": {
					const file = u.filesById.get(params.fileId);
					if (!file) throw new Error(`file not found: ${params.fileId}`);
					const cacheKey = `blob:${params.fileId}`;
					cache.set(cacheKey, file.text);
					return {
						ref: { cacheKey, sizeBytes: file.text.length },
						metadata: {
							id: params.fileId,
							name: file.name,
							fileSize: file.text.length,
						},
					};
				}
				case "files.extractText": {
					const { ref, maxChars } = params.input;
					const text = cache.get(ref.cacheKey) ?? "";
					const capped = maxChars > 0 && text.length > maxChars;
					return {
						text: capped ? text.slice(0, maxChars) : text,
						chars: text.length,
						truncated: capped,
					};
				}

				case "sales.parseImportLeads":
					return u.parsed;
				case "sales.normalizeImportLeads": {
					const { leads, defaultLang, defaultType, tags } = params.input;
					let dropped = 0;
					const items = [];
					for (const raw of leads) {
						const description = (raw.description ?? raw.company ?? "").trim();
						if (!description) {
							dropped++;
							continue;
						}
						const leadId =
							raw.id ??
							`lead-${description.toLowerCase().replace(/\W+/g, "-")}`;
						items.push({
							lead: {
								id: leadId,
								description,
								lang: raw.lang || defaultLang,
								type: raw.type || defaultType,
								catalogId: "",
							},
							contacts: (raw.contacts ?? [])
								.filter((c: any) => c.value)
								.map((c: any) => ({
									id: `${leadId}-${c.type ?? "EMAIL"}-${c.value}`,
									leadId,
									type: c.type ?? "EMAIL",
									value: c.value,
									role: c.role ?? "",
									description: "",
								})),
							tags: [...(tags ?? []), ...(raw.tags ?? [])],
						});
					}
					return { items, dropped };
				}
				case "sales.addLead": {
					if (u.existing.has(params.lead.id))
						throw new Error("lead already exists");
					u.existing.add(params.lead.id);
					u.leads.push(params.lead);
					return params.lead.id;
				}
				case "sales.addContact": {
					if (u.existing.has(params.contact.id))
						throw new Error("contact already exists");
					u.existing.add(params.contact.id);
					u.contacts.push(params.contact);
					return params.contact.id;
				}
				case "sales.assignLeadTag": {
					u.tags.push({ leadId: params.leadId, tag: params.tagName });
					return null;
				}

				default:
					throw new Error(`unexpected call ${key}`);
			}
		},
	};

	return u;
}
