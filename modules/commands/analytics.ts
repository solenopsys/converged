import {
	BaseCommandProcessor,
	type CommandEntry,
	type Handler,
} from "dag-cli/base";
import { createCliNrpcClientConfig } from "dag-cli/ws";
import {
	type AnalyticsServiceClient,
	createAnalyticsServiceClient,
} from "g-analytics/browser";
import { importGeoLiteDatabase } from "./geolite-import";

const importHandler: Handler = async (
	client: AnalyticsServiceClient,
	_paramSplitter,
	param,
) => {
	const dataset = param?.trim().split(/\s+/)[0];
	if (dataset !== "country" && dataset !== "city" && dataset !== "asn") {
		throw new Error("Usage: analytics import <country|city|asn>");
	}
	await importGeoLiteDatabase(client, dataset);
};

class AnalyticsProcessor extends BaseCommandProcessor {
	protected initializeCommandMap(): Map<string, CommandEntry> {
		return new Map([
			[
				"import",
				{
					handler: importHandler,
					description:
						"Download, stream-import and refresh a GeoLite2 database: analytics import <country|city|asn>",
				},
			],
		]);
	}
}

export default () =>
	new AnalyticsProcessor(
		createAnalyticsServiceClient(createCliNrpcClientConfig()),
	);
