import React, { useEffect, useRef, useState } from "react";
import { downloadFile, services } from "files-state";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        "auto-rotate"?: boolean | "";
        "auto-rotate-delay"?: string;
        "camera-controls"?: boolean | "";
        "shadow-intensity"?: string;
        style?: React.CSSProperties;
      };
    }
  }
}

type Props = {
  fileId: string;
  alt?: string;
  style?: React.CSSProperties;
  className?: string;
};

export function ModelViewer({ fileId, alt = "3D model", style, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mvReady, setMvReady] = useState(false);
  const [hovered, setHovered] = useState(false);
  const prevUrl = useRef<string | null>(null);
  const mvRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    import("@google/model-viewer")
      .then(() => {
        console.log("[ModelViewer] @google/model-viewer loaded ✓");
        setMvReady(true);
      })
      .catch((e) => {
        console.error("[ModelViewer] Failed to load @google/model-viewer:", e);
        setMvReady(true); // попробуем всё равно
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    downloadFile(fileId, services.filesService, services.storeService)
      .then(({ blob }) => {
        if (cancelled) return;
        console.log("[ModelViewer] blob ready:", blob.size, "bytes, type:", blob.type);
        const objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        prevUrl.current = objectUrl;
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("[ModelViewer] download failed:", e);
          setError(e?.message ?? "Failed to load model");
        }
      });

    return () => {
      cancelled = true;
      if (prevUrl.current) {
        URL.revokeObjectURL(prevUrl.current);
        prevUrl.current = null;
      }
    };
  }, [fileId]);

  useEffect(() => {
    const el = mvRef.current;
    if (!el || !url) return;
    const handleError = (e: Event) => {
      console.error("[ModelViewer] model-viewer error event:", e);
      setError("3D model failed to render");
    };
    const handleLoad = () => console.log("[ModelViewer] model-viewer load ✓");
    el.addEventListener("error", handleError);
    el.addEventListener("load", handleLoad);
    return () => {
      el.removeEventListener("error", handleError);
      el.removeEventListener("load", handleLoad);
    };
  }, [url]);

  if (error) {
    return (
      <div className={className} style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 13 }}>
        {error}
      </div>
    );
  }

  if (!url || !mvReady) {
    return (
      <div className={className} style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 13 }}>
        {!mvReady ? "Загрузка viewer..." : "Загрузка модели..."}
      </div>
    );
  }

  return (
    <model-viewer
      ref={mvRef as any}
      src={url}
      alt={alt}
      // Без авто-вращения каждая плашка рисует кадр только когда что-то меняется
      // (on-demand). Постоянный render-loop включаем лишь на время наведения.
      {...(hovered ? { "auto-rotate": "", "auto-rotate-delay": "0" } : {})}
      camera-controls=""
      shadow-intensity="1"
      className={className}
      style={{ width: "100%", height: "100%", display: "block", ...style }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    />
  );
}
