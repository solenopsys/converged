import { translator } from "i18n";
import { useMemo, useState } from "preact/hooks";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import type { OperationParameters } from "../object-runtime";
import { cn } from "../lib/utils";

const t = translator(CHAT_MESSAGES_NAMESPACE);

type PropertySchema = {
	type?: string;
	title?: string;
	description?: string;
	enum?: Array<string | number>;
	default?: unknown;
};

export type OperationParametersDialogProps = {
	title: string;
	description?: string;
	parameters: OperationParameters;
	busy?: boolean;
	error?: string;
	onCancel: () => void;
	onSubmit: (params: Record<string, unknown>) => void;
};

const propertiesOf = (parameters: OperationParameters) =>
	Object.entries(
		(parameters.properties ?? {}) as Record<string, PropertySchema>,
	);

/** True when an operation needs nothing from the person running it. */
export const hasParameters = (parameters?: OperationParameters): boolean =>
	Boolean(parameters && propertiesOf(parameters).length > 0);

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
	const fields = useMemo(() => propertiesOf(parameters), [parameters]);
	const required = parameters.required ?? [];
	const [values, setValues] = useState<Record<string, unknown>>(() =>
		Object.fromEntries(
			fields
				.filter(([, schema]) => schema.default !== undefined)
				.map(([name, schema]) => [name, schema.default]),
		),
	);

	const missing = required.filter((name) => {
		const value = values[name];
		return value === undefined || value === "" || value === null;
	});

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
					{fields.map(([name, schema]) => {
						const label = schema.title ?? name;
						if (schema.enum) {
							return (
								<label key={name} class="block text-sm">
									<span class="mb-1 block font-medium">{label}</span>
									<select
										class="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
										value={String(values[name] ?? "")}
										onChange={(event) =>
											set(name, event.currentTarget.value)
										}
									>
										<option value="">—</option>
										{schema.enum.map((option) => (
											<option key={String(option)} value={String(option)}>
												{String(option)}
											</option>
										))}
									</select>
									{schema.description && (
										<span class="mt-1 block text-xs text-muted-foreground">
											{schema.description}
										</span>
									)}
								</label>
							);
						}
						if (schema.type === "boolean") {
							return (
								<label key={name} class="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={values[name] === true}
										onChange={(event) =>
											set(name, event.currentTarget.checked)
										}
									/>
									<span class="font-medium">{label}</span>
								</label>
							);
						}
						return (
							<label key={name} class="block text-sm">
								<span class="mb-1 block font-medium">{label}</span>
								<Input
									type={schema.type === "number" ? "number" : "text"}
									value={String(values[name] ?? "")}
									placeholder={schema.description}
									onInput={(event) =>
										set(
											name,
											schema.type === "number"
												? Number(event.currentTarget.value)
												: event.currentTarget.value,
										)
									}
								/>
							</label>
						);
					})}
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
