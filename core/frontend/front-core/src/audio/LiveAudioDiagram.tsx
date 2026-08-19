import {
	getDictationSnapshot,
	subscribeDictation,
	subscribeDictationLevel,
} from "../call/dictation";
import {
	getWebsiteCallSnapshot,
	subscribeWebsiteCall,
	subscribeWebsiteCallLevels,
} from "../call/web-call";
import { useEffect, useRef, useState } from "preact/hooks";
import { AudioDiagram, type AudioDiagramTrack } from "./AudioDiagram";

const HISTORY_SIZE = 48;
const FRAME_INTERVAL_MS = 50;

function isDictating(
	status: ReturnType<typeof getDictationSnapshot>["status"],
) {
	return (
		status === "starting" || status === "listening" || status === "finishing"
	);
}

function isCalling(
	status: ReturnType<typeof getWebsiteCallSnapshot>["status"],
) {
	return status === "connecting" || status === "connected";
}


export function LiveAudioDiagram() {
	const [dictation, setDictation] = useState(getDictationSnapshot);
	const [call, setCall] = useState(getWebsiteCallSnapshot);
	const levels = useRef({ user: 0, assistant: 0 });
	const history = useRef({
		user: Array<number>(HISTORY_SIZE).fill(0),
		assistant: Array<number>(HISTORY_SIZE).fill(0),
	});
	const [tracks, setTracks] = useState<AudioDiagramTrack[]>([]);
	const mode = isCalling(call.status)
		? "call"
		: isDictating(dictation.status)
			? "dictation"
			: null;

	useEffect(() => subscribeDictation(setDictation), []);
	useEffect(() => subscribeWebsiteCall(setCall), []);
	useEffect(
		() =>
			subscribeDictationLevel((level) => {
				levels.current.user = level;
			}),
		[],
	);
	useEffect(
		() =>
			subscribeWebsiteCallLevels((next) => {
				levels.current = next;
			}),
		[],
	);

	useEffect(() => {
		if (!mode) {
			history.current = {
				user: Array<number>(HISTORY_SIZE).fill(0),
				assistant: Array<number>(HISTORY_SIZE).fill(0),
			};
			setTracks([]);
			return;
		}
		let frame = 0;
		let lastSample = 0;
		const update = (now: number) => {
			if (now - lastSample >= FRAME_INTERVAL_MS) {
				lastSample = now;
				for (const source of ["user", "assistant"] as const) {
					history.current[source].shift();
					history.current[source].push(levels.current[source]);
				}
				setTracks(
					mode === "call"
						? [
								{
									id: "user",
									peaks: [...history.current.user],
									color: "#5aa8ff",
								},
								{
									id: "assistant",
									peaks: [...history.current.assistant],
									color: "#7ad99a",
								},
							]
						: [
								{
									id: "user",
									peaks: [...history.current.user],
									color: "#7ad99a",
								},
							],
				);
			}
			frame = requestAnimationFrame(update);
		};
		frame = requestAnimationFrame(update);
		return () => cancelAnimationFrame(frame);
	}, [mode]);

	if (!mode || tracks.length === 0) return null;
	return (
		<div
			class="composer-audio-diagram"
			aria-label={mode === "call" ? "Уровни звука звонка" : "Уровень микрофона"}
		>
			<AudioDiagram
				tracks={tracks}
				height={mode === "call" ? 42 : 30}
				ariaLabel={
					mode === "call" ? "Диаграмма разговора" : "Диаграмма диктовки"
				}
			/>
		</div>
	);
}
