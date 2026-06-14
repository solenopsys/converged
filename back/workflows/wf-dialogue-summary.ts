import { Workflow } from "@rt/engines/dag";
import {
	DialogueSummaryCollectNode,
	type DialogueSummaryParams,
	DialogueSummarizeNode,
	DialogueSummaryPersistNode,
} from "./nodes/dialogue-summary";

/**
 * Background pass that gives auto-generated titles/descriptions to chats and
 * calls. It pulls every dialogue still flagged `processed = false`, builds a
 * transcript (user messages whole, assistant messages clipped to a byte
 * budget), asks the configured LLM provider for a Title + Description, and
 * writes them back, marking the dialogue processed.
 *
 * Triggering (cron / event) is intentionally left out — run it directly with
 * `{ provider, maxMessageBytes, limit, dryRun }` params.
 */
export class DialogueSummaryWorkflow extends Workflow {
	private collect = new DialogueSummaryCollectNode("collect-unprocessed");
	private summarize = new DialogueSummarizeNode("summarize");
	private persist = new DialogueSummaryPersistNode("persist");

	async execute(params: DialogueSummaryParams = {}): Promise<void> {
		const { dialogues } = await this.invoke("collect-unprocessed", () =>
			this.collect.execute(params),
		);

		const items: Array<Record<string, unknown>> = [];
		let updated = 0;
		let skipped = 0;

		for (const ref of dialogues) {
			const key = `${ref.kind}-${ref.id}`;
			const { summary, skipped: noContent } = await this.invoke(
				`summarize-${key}`,
				() => this.summarize.execute({ ref, params }),
			);

			if (noContent) {
				skipped += 1;
				items.push({ kind: ref.kind, id: ref.id, status: "skipped-empty" });
				continue;
			}

			await this.invoke(`persist-${key}`, () =>
				this.persist.execute({ ref, summary, params }),
			);
			updated += 1;
			items.push({
				kind: ref.kind,
				id: ref.id,
				status: params.dryRun ? "dry-run" : "updated",
				title: summary.title,
				description: summary.description,
				flud: summary.flud,
			});
		}

		const result = { total: dialogues.length, updated, skipped, items };
		this.setVar("dialogue-summary:last-result", result);
		await this.invoke("final-result", async () => result);
	}
}

export const WORKFLOWS = [
	{ name: "dialogue-summary", ctor: DialogueSummaryWorkflow },
];

export default DialogueSummaryWorkflow;
