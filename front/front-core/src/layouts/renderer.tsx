// SlotRenderer.tsx
import React, { Suspense } from "react";
import { registry } from "./registry";

export function SlotRenderer({
  slot,
  cap,
  params,
  fallback,
}: {
  slot: "left" | "center" | "right" | "bottom";
  cap?: string | null;
  params?: any;
  fallback?: React.ReactNode;
}) {
  if (!cap) return null;

  const loader = registry.get(slot, cap);
  if (!loader) return <div className="p-3 text-red-500">Unknown cap: {cap}</div>;

  const Lazy = React.lazy(loader);
  return (
    <Suspense fallback={fallback ?? <div className="p-3">Loading…</div>}>
      <Lazy {...(params ?? {})} />
    </Suspense>
  );
}
