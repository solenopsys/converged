import { Input } from "../components/ui/input";

/**
 * The fields a JSON Schema asks for.
 *
 * One renderer, used by every screen that has to collect declared parameters —
 * an operation's dialog, a workflow's configuration. That is the point: a
 * screen never names a parameter, so adding one to a workflow costs a line in
 * its schema and no UI change at all. The moment a screen starts hardcoding
 * `senders` or `baseUrl`, it has begun growing into the form this replaces.
 */
export type PropertySchema = {
	type?: string;
	title?: string;
	description?: string;
	enum?: Array<string | number>;
	default?: unknown;
};

export type ParametersSchema = {
	type?: string;
	properties?: Record<string, unknown>;
	required?: string[];
};

export const propertiesOf = (
	parameters?: ParametersSchema,
): Array<[string, PropertySchema]> =>
	Object.entries((parameters?.properties ?? {}) as Record<string, PropertySchema>);

/** True when whatever this schema describes needs nothing from the person. */
export const hasParameters = (parameters?: ParametersSchema): boolean =>
	propertiesOf(parameters).length > 0;

/** The values a schema starts at, so a form opens filled in rather than blank. */
export const defaultsOf = (
	parameters?: ParametersSchema,
): Record<string, unknown> =>
	Object.fromEntries(
		propertiesOf(parameters)
			.filter(([, schema]) => schema.default !== undefined)
			.map(([name, schema]) => [name, schema.default]),
	);

/** Required properties still left empty. */
export const missingOf = (
	parameters: ParametersSchema | undefined,
	values: Record<string, unknown>,
): string[] =>
	(parameters?.required ?? []).filter((name) => {
		const value = values[name];
		return value === undefined || value === "" || value === null;
	});

export type SchemaFieldsProps = {
	parameters?: ParametersSchema;
	values: Record<string, unknown>;
	onChange: (name: string, value: unknown) => void;
	disabled?: boolean;
};

export const SchemaFields = ({
	parameters,
	values,
	onChange,
	disabled,
}: SchemaFieldsProps) => (
	<>
		{propertiesOf(parameters).map(([name, schema]) => {
			const label = schema.title ?? name;
			if (schema.enum) {
				return (
					<label key={name} class="block text-sm">
						<span class="mb-1 block font-medium">{label}</span>
						<select
							class="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
							value={String(values[name] ?? "")}
							disabled={disabled}
							onChange={(event) => onChange(name, event.currentTarget.value)}
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
							disabled={disabled}
							onChange={(event) => onChange(name, event.currentTarget.checked)}
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
						disabled={disabled}
						placeholder={schema.description}
						onInput={(event) =>
							onChange(
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
	</>
);
