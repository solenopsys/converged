/** Результат одного документа */
export interface SearchItem {
	title: string;
	link: string;
	snippet: string;
	pagemap?: any; // необработанный pagemap от Google
	image?: string; // пример: картинка, если есть в pagemap
	organization?: string; // пример: название компании
}

/** Опции запроса к Programmable Search */
export interface SearchOptions {
	q: string;

	num?: number;
	exactTerms?: string;
	excludeTerms?: string;
	siteSearch?: string;
	siteSearchFilter?: "i" | "e";
	fileType?: string;
	dateRestrict?: string;
	safe?: "off" | "active";
	gl?: string;
	lr?: string;
	excludeSites?: string[];
}

export class GoogleSearchService {
	private baseUrl = "https://www.googleapis.com/customsearch/v1";

	constructor(
		private apiKey: string,
		private cx: string,
	) {}

	async search(opts: SearchOptions): Promise<SearchItem[]> {
		const { q, num = 10, excludeSites = [], ...apiParams } = opts;

		const minusSites = excludeSites.map((s) => `-site:${s}`).join(" ");
		const query = [q, minusSites].filter(Boolean).join(" ");

		const params = new URLSearchParams({
			key: this.apiKey,
			cx: this.cx,
			q: query,
			num: Math.min(num, 10).toString(),
			...Object.fromEntries(
				Object.entries(apiParams).filter(([_, v]) => v !== undefined),
			),
		});

		const resp = await fetch(`${this.baseUrl}?${params}`);
		const body = await resp.text();

		if (!resp.ok) {
			let msg = `HTTP ${resp.status}`;
			try {
				msg = JSON.parse(body).error.message;
			} catch {}
			throw new Error(msg);
		}

		const data = JSON.parse(body);
		return (data.items ?? []).map((it: any): SearchItem => {
			const pagemap = it.pagemap || {};
			const image = pagemap?.cse_image?.[0]?.src || null;
			const organization = pagemap?.organization?.[0]?.name || null;

			return {
				title: it.title ?? "",
				link: it.link ?? "",
				snippet: it.snippet ?? "",

				organization,
			};
		});
	}
}
