import dotenv from "dotenv";
dotenv.config();

import { GoogleSearchService } from "./search";

const searchService = new GoogleSearchService(
	process.env.GOOGLE_API_KEY!,
	process.env.GOOGLE_CX!,
);

const results = await searchService.search({
	q: 'New York "3D printing service"',
	excludeSites: ["reddit.com", "quora.com"],
	exactTerms: '"3D printing"',
	num: 10,
	dateRestrict: "y1", // только за последний год
	lr: "lang_en",
});
console.log(JSON.stringify(results, null, 2));
