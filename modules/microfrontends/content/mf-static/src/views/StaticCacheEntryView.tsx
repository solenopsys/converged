import { HeaderPanel } from "front-core";
import type { StaticMeta } from "g-static";
import { useCallback, useEffect, useState } from "preact/compat";
import staticService from "../service";

export const StaticCacheEntryView = ({ entryId }: { entryId?: string }) => {
	const [entry, setEntry] = useState<StaticMeta | null>(null);
	const load = useCallback(async () => {
		if (!entryId) return;
		setEntry(await staticService.getMeta(entryId));
	}, [entryId]);
	useEffect(() => {
		void load();
	}, [load]);
	return (
		<div className="flex h-full min-h-0 flex-col">
			<HeaderPanel
				config={{ title: entry?.id ?? "SSR cache entry", actions: [] }}
			/>
			<div className="grid gap-4 overflow-auto p-4 sm:grid-cols-2">
				<div>
					<div className="text-xs text-muted-foreground">Status</div>
					<div>{entry?.status ?? "Not found"}</div>
				</div>
				<div>
					<div className="text-xs text-muted-foreground">Content type</div>
					<div>{entry?.contentType ?? "-"}</div>
				</div>
				<div>
					<div className="text-xs text-muted-foreground">Size</div>
					<div>{entry?.size ?? 0}</div>
				</div>
				<div>
					<div className="text-xs text-muted-foreground">Updated</div>
					<div>
						{entry ? new Date(entry.updatedAt * 1000).toLocaleString() : "-"}
					</div>
				</div>
			</div>
		</div>
	);
};
