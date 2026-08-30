import {
	executeOperation,
	invokeOperator,
	OPERATORS,
	type Operator,
	objectResolver,
} from "front-core/object-runtime";
import { registerSlashSection } from "./registry";

const code = (lines: string[]): string => ["```", ...lines, "```"].join("\n");

function registerObjectOperator(operator: Operator): void {
	registerSlashSection({
		name: operator,
		description: `Resolve ${operator} from the current object context`,
		fallback: async (param) => {
			const candidates = objectResolver.resolve(operator);
			if (!param) {
				return candidates.length > 0
					? code(candidates.map((candidate) => candidate.label))
					: "No target is available in the current context.";
			}
			const target = param.trim().toLocaleLowerCase();
			const candidate = candidates.find((entry) =>
				[entry.id, entry.targetType, entry.label]
					.filter(Boolean)
					.some((value) => value?.toLocaleLowerCase() === target),
			);
			if (!candidate) return `No ${operator} target matches "${param.trim()}".`;
			if (candidate.kind === "operation") {
				await executeOperation({ operationId: candidate.id, source: "user" });
			} else {
				await invokeOperator(
					operator,
					{ targetType: candidate.targetType },
					"user",
				);
			}
			return candidate.label;
		},
	});
}

export function registerBuiltinSlashCommands(): void {
	for (const operator of OPERATORS) registerObjectOperator(operator);
}
