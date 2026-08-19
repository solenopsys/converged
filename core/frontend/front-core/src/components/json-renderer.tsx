export function JsonRenderer({ data }: { data: any }) {
	const value = JSON.stringify(data, null, 2);

	return (
		<pre className="h-full w-full overflow-auto bg-transparent p-3 font-mono text-[13px] leading-[1.45] text-[var(--ui-foreground)]">
			{value}
		</pre>
	);
}
