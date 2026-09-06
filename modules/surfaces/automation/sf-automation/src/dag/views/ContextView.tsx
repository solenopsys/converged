import { useUnit } from "effector-preact";
import { JsonRenderer } from "front-core";
import React from "preact/compat";

export default function ContextView({ contextStore }: { contextStore: any }) {
	const data = useUnit(contextStore);
	if (!data) return <div className="p-4 text-muted-foreground">Loading...</div>;
	return <JsonRenderer data={data} />;
}
