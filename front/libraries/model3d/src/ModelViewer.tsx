import React, { useEffect, useRef, useState } from "react";
import "@google/model-viewer";
import { downloadFile, services } from "files-state";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        "auto-rotate"?: boolean | "";
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
  const prevUrl = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    downloadFile(fileId, services.filesService, services.storeService)
      .then(({ blob }) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        prevUrl.current = objectUrl;
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Failed to load model");
      });

    return () => {
      cancelled = true;
      if (prevUrl.current) {
        URL.revokeObjectURL(prevUrl.current);
        prevUrl.current = null;
      }
    };
  }, [fileId]);

  if (error) return <div className={className} style={style}>{error}</div>;
  if (!url)  return <div className={className} style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>;

  return (
    <model-viewer
      src={url}
      alt={alt}
      auto-rotate=""
      camera-controls=""
      shadow-intensity="1"
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
}
