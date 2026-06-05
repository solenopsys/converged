import { Workflow } from "@rt/engines/dag";
import {
	SalesReviewBuildDryRunResultNode,
	SalesReviewBuildEmailNode,
	SalesReviewBuildNoCandidateResultNode,
	SalesReviewBuildNoEmailResultNode,
	SalesReviewBuildSendFailedResultNode,
	SalesReviewBuildSentResultNode,
	SalesReviewCheckEmailContactNode,
	SalesReviewFindCandidateNode,
	type SalesReviewOutreachParams,
	SalesReviewRecordOutreachNode,
	SalesReviewSendEmailNode,
	SalesReviewValidateParamsNode,
} from "./nodes/sales-review-outreach";

export class SalesReviewOutreachWorkflow extends Workflow {
	private validateParams = new SalesReviewValidateParamsNode("validate-params");
	private findCandidate = new SalesReviewFindCandidateNode(
		"find-outreach-candidate",
	);
	private buildNoCandidateResult = new SalesReviewBuildNoCandidateResultNode(
		"build-no-candidate-result",
	);
	private buildNoEmailResult = new SalesReviewBuildNoEmailResultNode(
		"build-no-email-result",
	);
	private checkEmailContact = new SalesReviewCheckEmailContactNode(
		"check-email-contact",
	);
	private buildEmail = new SalesReviewBuildEmailNode("build-email");
	private buildDryRunResult = new SalesReviewBuildDryRunResultNode(
		"build-dry-run-result",
	);
	private sendEmail = new SalesReviewSendEmailNode("send-email");
	private buildSendFailedResult = new SalesReviewBuildSendFailedResultNode(
		"build-send-failed-result",
	);
	private recordOutreach = new SalesReviewRecordOutreachNode("record-outreach");
	private buildSentResult = new SalesReviewBuildSentResultNode(
		"build-sent-result",
	);

	async execute(input: SalesReviewOutreachParams): Promise<void> {
		const params = await this.invoke("validate-params", () =>
			this.validateParams.execute(input),
		);
		const candidate = await this.invoke("find-outreach-candidate", () =>
			this.findCandidate.execute(params),
		);

		if (!candidate.lead || !candidate.contact) {
			const result = await this.invoke("build-no-candidate-result", () =>
				this.buildNoCandidateResult.execute(params),
			);
			this.setVar("sales-review-outreach:last-result", result);
			await this.invoke("final-result", async () => result);
			return;
		}

		const { lead, contact } = candidate;
		const { hasEmail } = await this.invoke("check-email-contact", () =>
			this.checkEmailContact.execute({ contact }),
		);
		if (!hasEmail) {
			const result = await this.invoke("build-no-email-result", () =>
				this.buildNoEmailResult.execute({ lead, contact }),
			);
			this.setVar("sales-review-outreach:last-result", result);
			await this.invoke("final-result", async () => result);
			return;
		}

		const email = await this.invoke("build-email", () =>
			this.buildEmail.execute({ params, lead, contact }),
		);

		if (params.dryRun) {
			const result = await this.invoke("build-dry-run-result", () =>
				this.buildDryRunResult.execute({
					lead,
					contact,
					subject: email.subject,
					body: email.body,
				}),
			);
			this.setVar("sales-review-outreach:last-result", result);
			await this.invoke("final-result", async () => result);
			return;
		}

		const sendResult = await this.invoke(`send-email-${contact.id}`, () =>
			this.sendEmail.execute({
				params,
				contact,
				subject: email.subject,
				body: email.body,
			}),
		);

		if (!sendResult.success) {
			const result = await this.invoke("build-send-failed-result", () =>
				this.buildSendFailedResult.execute({
					lead,
					contact,
					error: sendResult.error,
				}),
			);
			this.setVar("sales-review-outreach:last-result", result);
			await this.invoke("final-result", async () => result);
			return;
		}

		await this.invoke(`record-event-${contact.id}`, () =>
			this.recordOutreach.execute({
				params,
				lead,
				contact,
				trackingCode: email.trackingCode,
				messageId: sendResult.messageId,
			}),
		);

		const result = await this.invoke("build-sent-result", () =>
			this.buildSentResult.execute({
				lead,
				contact,
				messageId: sendResult.messageId,
				trackingCode: email.trackingCode,
				subject: email.subject,
			}),
		);
		this.setVar("sales-review-outreach:last-result", result);
		await this.invoke("final-result", async () => result);
	}
}

export const WORKFLOWS = [
	{ name: "sales-review-outreach", ctor: SalesReviewOutreachWorkflow },
];
