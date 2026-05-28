import type { Meta, StoryObj } from "@storybook/react-vite";
import React, { useEffect, useState } from "react";
import { WaveformPlayer } from "mf-calls";
import { Button, Badge } from "front-core";
import { ArrowLeft, RefreshCw, MessageSquare, MicOff } from "lucide-react";

// ── Synthetic audio generator ─────────────────────────────────────────────────
// Builds a PCM WAV blob in-memory — no file, no network, works offline.

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function generateWavBlob(
  durationSec = 4,
  /** Primary tone in Hz */
  freq = 440,
  /** Amplitude envelope oscillation (Hz) — gives a "speech-burst" feel */
  envelopeFreq = 3,
  sampleRate = 22050,
): string {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buf = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buf);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, "WAVE");
  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);   // PCM
  view.setUint16(22, 1, true);   // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Speech-like: amplitude envelope oscillating + slight harmonic
    const envelope = 0.5 + 0.5 * Math.abs(Math.sin(Math.PI * envelopeFreq * t));
    const sample =
      (Math.sin(2 * Math.PI * freq * t) * 0.6 +
        Math.sin(2 * Math.PI * freq * 2 * t) * 0.2 +
        Math.sin(2 * Math.PI * freq * 3 * t) * 0.1) *
      envelope *
      0.35;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
  }

  const blob = new Blob([buf], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

// ── Mock transcript ───────────────────────────────────────────────────────────

type TranscriptItem = {
  time: number;
  source: "user" | "assistant";
  text: string;
};

const TRANSCRIPT: TranscriptItem[] = [
  { time: 1, source: "user",      text: "Добрый день! Я хотел бы узнать подробнее о вашем продукте." },
  { time: 5, source: "assistant", text: "Конечно! Наш продукт — это платформа для автоматизации коммуникаций с клиентами. Расскажите, какая задача вас интересует больше всего?" },
  { time: 14, source: "user",     text: "Нас интересует обработка входящих звонков и транскрипция разговоров." },
  { time: 20, source: "assistant",text: "Отлично. Мы поддерживаем real-time транскрипцию через WebRTC — это работает прямо в браузере без дополнительного ПО. Записи хранятся в облаке." },
  { time: 31, source: "user",     text: "А какой у вас тариф? Есть ли бесплатный пробный период?" },
  { time: 36, source: "assistant",text: "Есть 14-дневный trial без ограничений. После этого — от 3 900 рублей в месяц на команду. Могу выслать полный прайс на почту." },
  { time: 47, source: "user",     text: "Да, пожалуйста. И можно демо-сессию запланировать?" },
  { time: 52, source: "assistant",text: "Конечно! Пришлите удобное время — организуем 30-минутную демонстрацию с нашим специалистом. Запишу ваш контакт." },
];

const SHORT_TRANSCRIPT: TranscriptItem[] = TRANSCRIPT.slice(0, 3);

// ── Sub-components (mirrors CallDetailView's internals, props-driven) ─────────

const TranscriptLine: React.FC<{ line: TranscriptItem }> = ({ line }) => {
  const isUser = line.source === "user";
  return (
    <div className={`flex gap-2 text-sm ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-3 py-2 ${
          isUser
            ? "bg-blue-900/40 text-blue-100 rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        <div className="text-[10px] opacity-50 mb-0.5 font-mono">
          {isUser ? "You" : "AI"} · {new Date(line.time * 1000).toLocaleTimeString()}
        </div>
        {line.text}
      </div>
    </div>
  );
};

const MetaStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="text-center">
    <div className="text-xl font-bold tabular-nums">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

// ── Main story component ──────────────────────────────────────────────────────

type DemoProps = {
  hasUserAudio: boolean;
  hasAssistantAudio: boolean;
  transcript: TranscriptItem[];
  sessionId?: string;
};

const CallDetailDemo: React.FC<DemoProps> = ({
  hasUserAudio,
  hasAssistantAudio,
  transcript,
  sessionId = "01JXYZ8K2MPRWQ4N7STCBV6DE0",
}) => {
  const [userSrc, setUserSrc]           = useState<string | null>(null);
  const [assistantSrc, setAssistantSrc] = useState<string | null>(null);

  useEffect(() => {
    if (hasUserAudio)      setUserSrc(generateWavBlob(5, 280, 2.5));   // lower freq = human-like
    if (hasAssistantAudio) setAssistantSrc(generateWavBlob(6, 380, 3)); // slightly higher
  }, [hasUserAudio, hasAssistantAudio]);

  const label = sessionId.slice(0, 8).toUpperCase() + "…" + sessionId.slice(-4).toUpperCase();
  const firstLine = transcript[0]?.text ?? "";
  const summary = transcript.length > 0
    ? `${transcript.length} lines · ${Math.min(
        transcript.filter(t => t.source === "user").length,
        transcript.filter(t => t.source === "assistant").length
      )} exchanges · "${firstLine.slice(0, 55)}${firstLine.length > 55 ? "…" : ""}"`
    : "No transcript";

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">

      {/* Header */}
      <div className="border-b bg-background flex items-center h-14 px-4 gap-3 shrink-0">
        <Button variant="outline" size="sm" onClick={() => {}} className="gap-1.5">
          <ArrowLeft size={14} />
          Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold leading-tight">
            Session{" "}
            <code className="font-mono text-sm text-muted-foreground">{label}</code>
          </h1>
          <p className="text-xs text-muted-foreground truncate">{summary}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => {}} className="gap-1.5 shrink-0">
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      {/* Two-column body */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_380px]">

          {/* Left: waveforms */}
          <div className="flex flex-col gap-4 p-4 border-r border-border min-h-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              Recordings
            </p>

            {!hasUserAudio && !hasAssistantAudio ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
                <MicOff size={32} className="opacity-30" />
                <p className="text-sm">No recordings available for this session.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {hasUserAudio && userSrc && (
                  <WaveformPlayer src={userSrc} label="You" color="#3b82f6" />
                )}
                {hasAssistantAudio && assistantSrc && (
                  <WaveformPlayer src={assistantSrc} label="AI" color="#22c55e" />
                )}
              </div>
            )}

            {/* Metadata strip */}
            {transcript.length > 0 && (
              <div className="mt-auto pt-4 border-t border-border grid grid-cols-3 gap-3">
                <MetaStat label="Lines" value={String(transcript.length)} />
                <MetaStat
                  label="You said"
                  value={String(transcript.filter(t => t.source === "user").length)}
                />
                <MetaStat
                  label="AI said"
                  value={String(transcript.filter(t => t.source === "assistant").length)}
                />
              </div>
            )}
          </div>

          {/* Right: transcript */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
              <MessageSquare size={14} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Transcript
              </span>
              {transcript.length > 0 && (
                <Badge variant="outline" className="text-xs ml-auto">
                  {transcript.length} lines
                </Badge>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {transcript.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No transcript available.</p>
              ) : (
                transcript.map((line, i) => <TranscriptLine key={i} line={line} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Storybook meta ────────────────────────────────────────────────────────────

const meta = {
  title: "Calls/CallDetail",
  component: CallDetailDemo,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ height: "680px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CallDetailDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Stories ───────────────────────────────────────────────────────────────────

export const FullSession: Story = {
  name: "Full session — audio + transcript",
  args: {
    hasUserAudio: true,
    hasAssistantAudio: true,
    transcript: TRANSCRIPT,
  },
};

export const AudioOnly: Story = {
  name: "Audio only — no transcript",
  args: {
    hasUserAudio: true,
    hasAssistantAudio: true,
    transcript: [],
  },
};

export const TranscriptOnly: Story = {
  name: "Transcript only — no recordings",
  args: {
    hasUserAudio: false,
    hasAssistantAudio: false,
    transcript: TRANSCRIPT,
  },
};

export const UserTrackOnly: Story = {
  name: "User track only",
  args: {
    hasUserAudio: true,
    hasAssistantAudio: false,
    transcript: SHORT_TRANSCRIPT,
  },
};

export const EmptySession: Story = {
  name: "Empty session",
  args: {
    hasUserAudio: false,
    hasAssistantAudio: false,
    transcript: [],
  },
};

// ── WaveformPlayer standalone ─────────────────────────────────────────────────

const WaveformDemo: React.FC<{ color: string; label: string; durationSec: number }> = ({
  color,
  label,
  durationSec,
}) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    setSrc(generateWavBlob(durationSec, 340, 2));
  }, [durationSec]);

  return (
    <div className="p-6 bg-background text-foreground rounded-xl" style={{ width: 640 }}>
      {src ? (
        <WaveformPlayer src={src} label={label} color={color} />
      ) : (
        <p className="text-sm text-muted-foreground">Generating audio…</p>
      )}
    </div>
  );
};

export const WaveformPlayerStory: StoryObj<typeof WaveformDemo> = {
  name: "WaveformPlayer standalone",
  render: () => (
    <div className="p-8 bg-background text-foreground flex flex-col gap-8 min-h-screen">
      <div>
        <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">User track</p>
        <WaveformDemo color="#3b82f6" label="You" durationSec={5} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">AI track</p>
        <WaveformDemo color="#22c55e" label="AI" durationSec={7} />
      </div>
    </div>
  ),
};
