export type MagicPrompt = {
	id: string;
	label: string;
	message: string;
};

export function MagicPrompts({
	prompts,
	onSubmit,
}: {
	prompts: readonly MagicPrompt[];
	onSubmit: (message: string) => void;
}) {
	if (prompts.length === 0) return null;

	return (
		<div class="magic-prompts">
			{prompts.map((prompt) => (
				<button
					type="button"
					class="magic-prompt"
					key={prompt.id}
					onClick={() => onSubmit(prompt.message)}
				>
					{prompt.label}
				</button>
			))}
		</div>
	);
}
