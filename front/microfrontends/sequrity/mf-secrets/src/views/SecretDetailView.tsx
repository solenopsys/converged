import { useState, useEffect } from "react";
import { useUnit } from "effector-react";
import { Button, Input, Label } from "front-core";
import { Plus, Trash2, Save } from "lucide-react";
import { $currentSecret, setSecretFx } from "../domain-secrets";

export const SecretDetailView = () => {
  const current = useUnit($currentSecret);
  const [entries, setEntries] = useState<{ key: string; value: string }[]>([]);
  const saving = useUnit(setSecretFx.pending);

  useEffect(() => {
    if (current?.data) {
      setEntries(Object.entries(current.data).map(([key, value]) => ({ key, value })));
    }
  }, [current]);

  if (!current) {
    return <div className="p-6 text-muted-foreground">Select a secret to view</div>;
  }

  const handleSave = async () => {
    const data: Record<string, string> = {};
    for (const { key, value } of entries) {
      if (key.trim()) data[key.trim()] = value;
    }
    await setSecretFx({ name: current.name, data });
  };

  const updateEntry = (index: number, field: "key" | "value", val: string) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: val } : e)));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold font-mono">{current.name}</h2>
        <p className="text-sm text-muted-foreground mt-1">Edit secret key-value pairs</p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
        {entries.map((entry, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              placeholder="KEY"
              value={entry.key}
              onChange={(e) => updateEntry(i, "key", e.target.value)}
              className="font-mono w-40"
            />
            <Input
              placeholder="value"
              value={entry.value}
              onChange={(e) => updateEntry(i, "value", e.target.value)}
              className="font-mono flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEntries((prev) => prev.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setEntries((prev) => [...prev, { key: "", value: "" }])}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add key
        </Button>
      </div>

      <div className="border-t px-6 py-4">
        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save to k8s"}
        </Button>
      </div>
    </div>
  );
};
