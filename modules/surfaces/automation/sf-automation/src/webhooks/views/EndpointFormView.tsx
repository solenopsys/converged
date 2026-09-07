import { useUnit } from "effector-preact";
import { Button, Input, Label, Textarea, Trash2 } from "front-core";
import type { WebhookVerification } from "g-webhooks";
import {
	$endpointDraft,
	$endpointSaving,
	deleteEndpointClicked,
	endpointFieldChanged,
	endpointFormClosed,
	saveEndpointClicked,
} from "../domain-endpoints";

const VERIFICATIONS: WebhookVerification[] = ["none", "secret", "hmac"];

/**
 * An endpoint is a public URL and the topic it turns into. The gateway does no
 * work of its own: it checks the signature and publishes one event, so what
 * actually happens is decided by whichever trigger subscribes to that topic.
 */
export function EndpointFormView() {
	const draft = useUnit($endpointDraft);
	const saving = useUnit($endpointSaving);

	if (!draft)
		return (
			<div className="p-4 text-muted-foreground">No endpoint selected</div>
		);

	return (
		<div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
			<div className="flex items-center justify-between">
				<strong>{draft.id ? "Edit endpoint" : "New endpoint"}</strong>
				{draft.id && (
					<Button
						variant="outline"
						size="sm"
						disabled={saving}
						onClick={() => deleteEndpointClicked()}
					>
						<Trash2 className="mr-1 h-3 w-3" />
						Delete
					</Button>
				)}
			</div>

			<Field label="Name">
				<Input
					value={draft.name}
					placeholder="Stripe payments"
					onInput={(event: any) => {
						endpointFieldChanged({ name: event.currentTarget.value });
					}}
				/>
			</Field>

			<Field label="Provider">
				<Input
					value={draft.provider}
					placeholder="stripe"
					onInput={(event: any) => {
						endpointFieldChanged({ provider: event.currentTarget.value });
					}}
				/>
			</Field>

			<Field
				label="Slug"
				hint="Last segment of /webhooks/<slug>. Derived from the name when empty"
			>
				<Input
					value={draft.slug}
					placeholder="stripe-payments"
					onInput={(event: any) => {
						endpointFieldChanged({ slug: event.currentTarget.value });
					}}
				/>
			</Field>

			<Field
				label="Topic"
				hint="Published on arrival. Defaults to webhook.<provider>.<slug>"
			>
				<Input
					value={draft.topic}
					placeholder="webhook.stripe.payments"
					onInput={(event: any) => {
						endpointFieldChanged({ topic: event.currentTarget.value });
					}}
				/>
			</Field>

			<Field label="Verification">
				<select
					className="h-9 rounded border bg-background px-2 text-sm"
					value={draft.verify}
					onChange={(event: any) => {
						endpointFieldChanged({
							verify: event.currentTarget.value as WebhookVerification,
						});
					}}
				>
					{VERIFICATIONS.map((value) => (
						<option key={value} value={value}>
							{value}
						</option>
					))}
				</select>
			</Field>

			<Field
				label="Parameters"
				hint="JSON object: the provider's own settings, secrets included"
			>
				<Textarea
					className="min-h-32 font-mono text-sm"
					value={draft.params}
					onInput={(event: any) => {
						endpointFieldChanged({ params: event.currentTarget.value });
					}}
				/>
			</Field>

			<label className="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={draft.enabled}
					onChange={(event: any) => {
						endpointFieldChanged({ enabled: event.currentTarget.checked });
					}}
				/>
				Enabled
			</label>

			{draft.error && (
				<div className="text-destructive text-sm">{draft.error}</div>
			)}

			<div className="flex gap-2">
				<Button disabled={saving} onClick={() => saveEndpointClicked()}>
					{saving ? "Saving…" : "Save"}
				</Button>
				<Button
					variant="outline"
					disabled={saving}
					onClick={() => endpointFormClosed()}
				>
					Cancel
				</Button>
			</div>
		</div>
	);
}

function Field({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: any;
}) {
	return (
		<div className="flex flex-col gap-1">
			<Label>{label}</Label>
			{children}
			{hint && <span className="text-muted-foreground text-xs">{hint}</span>}
		</div>
	);
}

export default EndpointFormView;
