import { Pause, Play } from "../icons";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { AudioDiagram } from "./AudioDiagram";

type StereoCallPlayerProps = {
	userSrc: string | null;
	aiSrc: string | null;
	userColor?: string;
	aiColor?: string;
};

type DecodedTracks = {
	user: Float32Array | null;
	ai: Float32Array | null;
	sampleRate: number;
};

function formatTime(seconds: number) {
	if (!Number.isFinite(seconds)) return "0:00";
	const minutes = Math.floor(seconds / 60);
	return `${minutes}:${Math.floor(seconds % 60)
		.toString()
		.padStart(2, "0")}`;
}

async function decodeMono(context: AudioContext, source: string | null) {
	if (!source) return null;
	const response = await fetch(source);
	if (!response.ok)
		throw new Error(`Audio download failed (${response.status})`);
	const decoded = await context.decodeAudioData(await response.arrayBuffer());
	return decoded.getChannelData(0).slice();
}

function lastSignalIndex(data: Float32Array | null) {
	if (!data?.length) return 0;
	let peak = 0;
	for (const value of data) peak = Math.max(peak, Math.abs(value));
	const threshold = Math.max(0.01, peak * 0.05);
	for (let index = data.length - 1; index >= 0; index -= 1) {
		if (Math.abs(data[index]) >= threshold) return index + 1;
	}
	return 0;
}

function buildPeaks(data: Float32Array | null, count = 400) {
	if (!data?.length) return null;
	const peaks = new Float32Array(count);
	const block = Math.max(1, Math.floor(data.length / count));
	for (let index = 0; index < count; index += 1) {
		let peak = 0;
		for (
			let offset = index * block;
			offset < Math.min(data.length, (index + 1) * block);
			offset += 1
		) {
			peak = Math.max(peak, Math.abs(data[offset] ?? 0));
		}
		peaks[index] = peak;
	}
	return peaks;
}

function encodeStereoWav(
	left: Float32Array,
	right: Float32Array,
	sampleRate: number,
) {
	const frames = Math.max(left.length, right.length);
	const buffer = new ArrayBuffer(44 + frames * 4);
	const view = new DataView(buffer);
	const write = (offset: number, value: string) => {
		for (let index = 0; index < value.length; index += 1)
			view.setUint8(offset + index, value.charCodeAt(index));
	};
	write(0, "RIFF");
	view.setUint32(4, 36 + frames * 4, true);
	write(8, "WAVE");
	write(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 2, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 4, true);
	view.setUint16(32, 4, true);
	view.setUint16(34, 16, true);
	write(36, "data");
	view.setUint32(40, frames * 4, true);
	let offset = 44;
	for (let index = 0; index < frames; index += 1) {
		const writeSample = (value: number) =>
			view.setInt16(offset, Math.max(-1, Math.min(1, value)) * 0x7fff, true);
		writeSample(left[index] ?? 0);
		offset += 2;
		writeSample(right[index] ?? 0);
		offset += 2;
	}
	return new Blob([buffer], { type: "audio/wav" });
}


export function StereoCallPlayer({
	userSrc,
	aiSrc,
	userColor = "#3b82f6",
	aiColor = "#22c55e",
}: StereoCallPlayerProps) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const mixedUrl = useRef<string | null>(null);
	const [state, setState] = useState<"loading" | "ready" | "error">("loading");
	const [error, setError] = useState<string | null>(null);
	const [playing, setPlaying] = useState(false);
	const [progress, setProgress] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [tracks, setTracks] = useState<DecodedTracks | null>(null);

	useEffect(() => {
		let cancelled = false;
		setState("loading");
		setError(null);
		setTracks(null);
		setPlaying(false);
		setProgress(0);
		void (async () => {
			const context = new AudioContext();
			try {
				const [user, ai] = await Promise.all([
					decodeMono(context, userSrc),
					decodeMono(context, aiSrc),
				]);
				if (cancelled) return;
				if (!user && !ai) throw new Error("No audio available");
				const rawEnd = Math.max(user?.length ?? 0, ai?.length ?? 0);
				const signalEnd = Math.max(lastSignalIndex(user), lastSignalIndex(ai));
				const end = signalEnd
					? Math.min(rawEnd, signalEnd + Math.round(context.sampleRate * 0.25))
					: rawEnd;
				const clippedUser = user?.subarray(0, end) ?? null;
				const clippedAi = ai?.subarray(0, end) ?? null;
				const left = clippedUser ?? clippedAi;
				const right = clippedAi ?? clippedUser;
				if (!left || !right) throw new Error("No audio available");
				const url = URL.createObjectURL(
					encodeStereoWav(left, right, context.sampleRate),
				);
				if (mixedUrl.current) URL.revokeObjectURL(mixedUrl.current);
				mixedUrl.current = url;
				if (audioRef.current) audioRef.current.src = url;
				setTracks({
					user: clippedUser,
					ai: clippedAi,
					sampleRate: context.sampleRate,
				});
				setDuration(Math.max(left.length, right.length) / context.sampleRate);
				setState("ready");
			} catch (cause) {
				if (!cancelled) {
					setError(cause instanceof Error ? cause.message : String(cause));
					setState("error");
				}
			} finally {
				void context.close();
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [aiSrc, userSrc]);

	useEffect(
		() => () => {
			if (mixedUrl.current) URL.revokeObjectURL(mixedUrl.current);
		},
		[],
	);

	const diagramTracks = useMemo(() => {
		if (!tracks) return [];
		const total = Math.max(tracks.user?.length ?? 0, tracks.ai?.length ?? 0, 1);
		return [
			{
				id: "user",
				peaks: buildPeaks(tracks.user),
				color: userColor,
				span: (tracks.user?.length ?? 0) / total,
			},
			{
				id: "assistant",
				peaks: buildPeaks(tracks.ai),
				color: aiColor,
				span: (tracks.ai?.length ?? 0) / total,
			},
		];
	}, [aiColor, tracks, userColor]);

	const seek = (nextProgress: number) => {
		const audio = audioRef.current;
		if (!audio || !audio.duration) return;
		audio.currentTime = nextProgress * audio.duration;
		setProgress(nextProgress);
		setCurrentTime(audio.currentTime);
	};

	const togglePlayback = () => {
		const audio = audioRef.current;
		if (!audio) return;
		if (audio.paused) void audio.play();
		else audio.pause();
	};

	return (
		<div class="flex flex-col gap-2">
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-3 text-xs font-semibold">
					<span style={{ color: userColor }}>You</span>
					<span style={{ color: aiColor }}>AI</span>
				</div>
				<span class="text-xs tabular-nums text-muted-foreground">
					{formatTime(currentTime)} / {formatTime(duration)}
				</span>
			</div>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onClick={togglePlayback}
					disabled={state !== "ready"}
					class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground/10 hover:bg-foreground/20 disabled:opacity-40"
					aria-label={playing ? "Pause call recording" : "Play call recording"}
				>
					{playing ? <Pause size={15} /> : <Play size={15} />}
				</button>
				{state === "error" ? (
					<p class="text-xs text-red-400">{error}</p>
				) : (
					<AudioDiagram
						tracks={diagramTracks}
						progress={progress}
						height={64}
						class="min-w-0 flex-1 cursor-pointer"
						ariaLabel="Call recording waveform"
						onSeek={state === "ready" ? seek : undefined}
					/>
				)}
			</div>
			<audio
				ref={audioRef}
				preload="auto"
				onPlay={() => setPlaying(true)}
				onPause={() => setPlaying(false)}
				onTimeUpdate={(event) => {
					const audio = event.currentTarget;
					setCurrentTime(audio.currentTime);
					setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
				}}
				onEnded={() => setProgress(1)}
				class="hidden"
			/>
		</div>
	);
}
