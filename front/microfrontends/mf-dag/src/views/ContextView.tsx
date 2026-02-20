import React from 'react';
import { useUnit } from 'effector-react';
import { JsonRenderer } from 'front-core';

export default function ContextView({ contextStore }: { contextStore: any }) {
  const data = useUnit(contextStore);
  if (!data) return <div className="p-4 text-muted-foreground">Loading...</div>;
  return <JsonRenderer data={data} />;
}