import { useEffect, useRef, useState } from "preact/hooks";

export type AudioDiagramTrack = {
	id: string;
	peaks: ArrayLike<number> | null;
	color: string;

	span?: number;
};

type AudioDiagramProps = {
	tracks: readonly AudioDiagramTrack[];

	progress?: number;
	height?: number;
	class?: string;
	ariaLabel: string;
	onSeek?: (progress: number) => void;
};

function clamp(value: number) {
	return Math.min(1, Math.max(0, value));
}


export function AudioDiagram({
	tracks,
	progress,
	height = 64,
	class: className,
	ariaLabel,
	onSeek,
}: AudioDiagramProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [width, setWidth] = useState(0);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const update = () =>
			setWidth(Math.round(canvas.getBoundingClientRect().width));
		update();
		const observer = new ResizeObserver(update);
		observer.observe(canvas);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || width === 0) return;
		const pixelRatio = window.devicePixelRatio || 1;
		const cssHeight = height;
		canvas.width = Math.max(1, Math.round(width * pixelRatio));
		canvas.height = Math.max(1, Math.round(cssHeight * pixelRatio));
		const context = canvas.getContext("2d");
		if (!context) return;
		context.scale(pixelRatio, pixelRatio);
		context.clearRect(0, 0, width, cssHeight);

		const count = Math.max(1, Math.floor(width / 3));
		const twoTracks = tracks.length > 1;
		const mid = cssHeight / 2;
		if (twoTracks) {
			context.fillStyle = "rgba(127, 127, 127, 0.22)";
			context.fillRect(0, mid - 0.5, width, 1);
		}

		for (let bar = 0; bar < count; bar += 1) {
			const position = bar / count;
			const played = progress === undefined || position <= progress;
			for (let index = 0; index < tracks.length; index += 1) {
				const track = tracks[index];
				const span = clamp(track.span ?? 1);
				if (!track.peaks || span === 0 || position >= span) continue;
				const sampleIndex = Math.min(
					track.peaks.length - 1,
					Math.floor((position / span) * track.peaks.length),
				);
				const amplitude = clamp(track.peaks[sampleIndex] ?? 0);
				const trackHeight = twoTracks ? mid - 4 : cssHeight / 2 - 3;
				const size = Math.max(1, amplitude * trackHeight);
				const top = twoTracks ? index === 0 : true;
				const center = twoTracks ? mid : cssHeight / 2;
				context.globalAlpha = played ? 1 : 0.27;
				context.fillStyle = track.color;
				context.fillRect(bar * 3, top ? center - size : center, 2, size);
			}
		}
		context.globalAlpha = 1;
		if (progress !== undefined) {
			context.fillStyle = "rgba(255, 255, 255, 0.86)";
			context.fillRect(clamp(progress) * width, 0, 1, cssHeight);
		}
	}, [height, progress, tracks, width]);

	return (
		<canvas
			ref={canvasRef}
			class={className}
			style={{ display: "block", width: "100%", height: `${height}px` }}
			aria-label={ariaLabel}
			role="img"
			onClick={
				onSeek
					? (event) => {
							const rect = event.currentTarget.getBoundingClientRect();
							onSeek(clamp((event.clientX - rect.left) / rect.width));
						}
					: undefined
			}
		/>
	);
}
