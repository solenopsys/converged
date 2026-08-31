import { useEffect, useRef, useState } from "preact/hooks";
import { Input } from "../../components/ui/input";
import type { TableFilterConfig } from "./types";

type FilterTextInputProps = {
	filter: TableFilterConfig;
	value: string;
	onValueChange: (value: string) => void;
};

export function FilterTextInput({
	filter,
	value,
	onValueChange,
}: FilterTextInputProps) {
	const [draft, setDraft] = useState(value);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setDraft(value);
	}, [value]);

	useEffect(
		() => () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		},
		[],
	);

	const change = (next: string) => {
		setDraft(next);
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(
			() => onValueChange(next),
			filter.debounceMs ?? 400,
		);
	};

	return (
		<Input
			value={draft}
			onInput={(event) => change((event.target as HTMLInputElement).value)}
			placeholder={filter.placeholder ?? filter.label}
			aria-label={filter.label ?? filter.id}
			className="h-7 w-full min-w-0 text-xs"
		/>
	);
}
