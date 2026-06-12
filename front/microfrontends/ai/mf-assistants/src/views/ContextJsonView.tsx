import React, { useEffect, useState } from "react";
import { JsonRenderer, useMicrofrontendTranslation } from "front-core";
import { assistantClient } from "../services";
import type { ChatContext } from "../types";

type ContextJsonViewProps = {
	chatId: string;
};

export const ContextJsonView: React.FC<ContextJsonViewProps> = ({ chatId }) => {
	const { t } = useMicrofrontendTranslation("assistants-mf");
	const [context, setContext] = useState<ChatContext | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		setLoading(true);
		setError(null);
		setContext(null);

		assistantClient
			.getContext(chatId)
			.then((loadedContext) => {
				if (!cancelled) {
					setContext(loadedContext);
				}
			})
			.catch((loadError: any) => {
				if (!cancelled) {
					setError(loadError?.message || t("contextsList.errors.loadFailed"));
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [chatId, t]);

	if (loading) {
		return (
			<div className="p-4 text-sm text-muted-foreground">
				{t("common.loading")}
			</div>
		);
	}

	if (error) {
		return <div className="p-4 text-sm text-destructive">{error}</div>;
	}

	return <JsonRenderer data={context?.data ?? {}} />;
};
