import React, { useEffect, useState } from "react";
import { Button, defaultLanguage } from "front-core";
import { contextsClient } from "../services";
import { refreshContextsClicked } from "../domain-contexts";

type ContextEditViewProps = {
  /** Existing context to edit; empty for a new one. */
  name?: string;
  language?: string;
};

/**
 * Author a context: name + language + prompt (`data`). One context per
 * `<language>/<name>` — same name in another language is a separate entry.
 */
export const ContextEditView: React.FC<ContextEditViewProps> = ({
  name: initialName,
  language: initialLanguage,
}) => {
  const isNew = !initialName;
  const [name, setName] = useState(initialName ?? "");
  const [language, setLanguage] = useState(initialLanguage ?? defaultLanguage);
  const [data, setData] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialName) return;
    setStatus("loading");
    contextsClient
      .getContext(initialName, initialLanguage)
      .then((ctx) => {
        if (!ctx) return;
        setLanguage(ctx.language ?? defaultLanguage);
        setData(typeof ctx.data === "string" ? ctx.data : JSON.stringify(ctx.data, null, 2));
        setStatus("idle");
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load");
        setStatus("error");
      });
  }, [initialName, initialLanguage]);

  const handleSave = async () => {
    const n = name.trim();
    const lang = language.trim();
    const prompt = data.trim();
    if (!n || !lang || !prompt) {
      setError("Name, language and prompt are all required.");
      setStatus("error");
      return;
    }
    setError(null);
    try {
      await contextsClient.saveContext({ name: n, language: lang, data: prompt });
      setStatus("saved");
      refreshContextsClicked();
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setStatus("error");
    }
  };

  const handleDelete = async () => {
    if (isNew) return;
    await contextsClient.deleteContext(name.trim(), language.trim());
    refreshContextsClicked();
    setData("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!isNew}
          placeholder="context name (e.g. request)"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          placeholder={defaultLanguage}
          className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <textarea
        value={data}
        onChange={(e) => setData(e.target.value)}
        placeholder="System prompt the assistant / voice gate runs with…"
        className="flex-1 min-h-[240px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleSave}>
          {status === "saved" ? "Saved ✓" : status === "loading" ? "Loading…" : "Save"}
        </Button>
        {!isNew && (
          <Button size="sm" variant="ghost" onClick={handleDelete}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
};
