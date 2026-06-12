import React, { useEffect, useState } from "react";
import { JsonRenderer } from "front-core";
import { callsClient, type CallContext } from "g-calls";

type ContextJsonViewProps = {
  name: string;
};

export const ContextJsonView: React.FC<ContextJsonViewProps> = ({ name }) => {
  const [context, setContext] = useState<CallContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setContext(null);

    callsClient
      .getContext(name)
      .then((loadedContext) => {
        if (!cancelled) setContext(loadedContext);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load context");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [name]);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-destructive">{error}</div>;
  }

  return <JsonRenderer data={context ?? {}} />;
};
