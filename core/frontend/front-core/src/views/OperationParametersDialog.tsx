import { translator } from "i18n";
import { useState } from "preact/hooks";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { Button } from "../components/ui/button";
import type { OperationParameters } from "../object-runtime";
import { cn } from "../lib/utils";
import { defaultsOf, missingOf, SchemaFields } from "./SchemaFields";

// EntityListView asks this before opening the dialog at all; it lives with the
// renderer now, and is re-exported so its callers keep one import.
export { hasParameters } from "./SchemaFields";

const t = translator(CHAT_MESSAGES_NAMESPACE);

export type OperationParametersDialogProps = {
	title: string;
	description?: string;
	parameters: OperationParameters;
	busy?: boolean;
	error?: string;
	onCancel: () => void;
	onSubmit: (params: Record<string, unknown>) => void;
};

/**
 * The form an operation asks for, built from its own `parameters` schema — the
 * same schema the assistant fills in when it calls the operation. A command
 * that needs a name is therefore declared once and works from both sides.
 */
export const OperationParametersDialog = ({
	title,
	description,
	parameters,
	busy,
	error,
	onCancel,
	onSubmit,
}: OperationParametersDialogProps) => {
	const [values, setValues] = useState<Record<string, unknown>>(() =>
		defaultsOf(parameters),
	);
	const missing = missingOf(parameters, values);

	const set = (name: string, value: unknown) =>
		setValues((current) => ({ ...current, [name]: value }));

	return (
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
			onClick={(event) => {
				if (event.target === event.currentTarget) onCancel();
			}}
		>
			<div class="w-full max-w-md rounded-lg border bg-background p-5 shadow-lg">
				<h2 class="text-base font-semibold">{title}</h2>
				{description && (
					<p class="mt-1 text-sm text-muted-foreground">{description}</p>
				)}
				<div class="mt-4 space-y-3">
					<SchemaFields
						parameters={parameters}
						values={values}
						onChange={set}
					/>
				</div>
				{error && (
					<p class="mt-3 text-sm text-destructive" role="alert">
						{error}
					</p>
				)}
				<div class="mt-5 flex justify-end gap-2">
					<Button variant="outline" onClick={onCancel} disabled={busy}>
						{t("operation.cancel")}
					</Button>
					<Button
						onClick={() => onSubmit(values)}
						disabled={busy || missing.length > 0}
						class={cn(busy && "opacity-70")}
					>
						{busy ? t("operation.running") : t("operation.run")}
					</Button>
				</div>
			</div>
		</div>
	);
};
