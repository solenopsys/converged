import React from "react";
import { Badge } from "front-core";

type AudioPlayerProps = {
	/** Object URL created from audio returned by ms-calls. */
  src: string;
  label?: string;
  variant?: "user" | "assistant";
};

/**
 * Lightweight audio player for call recordings.
 * Uses the native <audio> element — no library dependencies.
 */
export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, label, variant = "user" }) => {
  const badgeClass =
    variant === "user"
      ? "bg-blue-900/30 text-blue-300 border-blue-800"
      : "bg-green-900/30 text-green-300 border-green-800";

  return (
    <div className="flex items-center gap-3 py-1">
      {label && (
        <Badge variant="outline" className={`shrink-0 text-xs ${badgeClass}`}>
          {label}
        </Badge>
      )}
      <audio
        src={src}
        controls
        preload="metadata"
        className="h-8 flex-1 min-w-0"
        style={{ colorScheme: "dark" }}
      />
    </div>
  );
};
