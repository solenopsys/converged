import { type INode } from "dag-api";
import { GoogleSearchService } from "./search-service";

export default class GoogleSearchNode implements INode {
	public scope!: string;

	private searchService: GoogleSearchService;

	constructor(
		public name: string,
		apiKey: string,
		cx: string
	) {
		this.searchService = new GoogleSearchService(apiKey, cx);
	}

	async execute(data: {
		q: string,
		excludeSites: string[],
		exactTerms: string,
		num: number,
		dateRestrict: string,
		lr: string,
	}): Promise<any> {
		const results = await this.searchService.search({
			q: data.q,
			excludeSites: data.excludeSites,
			exactTerms: data.exactTerms,
			num: data.num,
			dateRestrict: data.dateRestrict,
			lr: data.lr,
		});
		return results;
	}
}

