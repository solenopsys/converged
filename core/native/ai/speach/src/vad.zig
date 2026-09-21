const std = @import("std");

// Energy VAD over 20 ms frames of 48 kHz mono PCM, tuned on the resonus
// dictation fixture (dictation-ru.opus: 345 frames, 63 below RMS 50 —
// silence/DTX floor, speech median ~1600, p90 ~3200):
//
//   speech when RMS >= 400 (hysteresis: release below 200)
//   open after 3 speech frames (60 ms attack, kills stray clicks)
//   close after 50 silence frames (1000 ms hangover = dictation VAD_SILENCE_MS)
//   prefix kept: first 50 frames before open are prepended (1000 ms pre-roll,
//     dictation VAD_PREFIX_MS — opening words must not be cut)
//
// Thresholds are env-tunable (SPEACH_VAD_*), defaults match the dictation
// preset in gate/gateway.zig. This replaces the *server-side* OpenAI VAD:
// no vendor call, the segment boundaries are ours.
pub const Config = struct {
    speech_rms: f32 = 400,
    release_rms: f32 = 200,
    attack_frames: u32 = 3,
    hangover_frames: u32 = 50,
    prefix_frames: u32 = 50,

    pub fn fromEnv() Config {
        var cfg = Config{};
        if (vadEnvFloat("SPEACH_VAD_THRESHOLD")) |v| cfg.speech_rms = v;
        if (vadEnvFloat("SPEACH_VAD_RELEASE")) |v| cfg.release_rms = v;
        if (vadEnvU32("SPEACH_VAD_ATTACK_FRAMES")) |v| cfg.attack_frames = v;
        if (vadEnvU32("SPEACH_VAD_SILENCE_MS")) |v| cfg.hangover_frames = v / 20;
        if (vadEnvU32("SPEACH_VAD_PREFIX_MS")) |v| cfg.prefix_frames = v / 20;
        return cfg;
    }
};

pub const Event = enum { silence, speech_start, speech_continue, speech_end };

pub const Detector = struct {
    cfg: Config,
    in_speech: bool = false,
    attack: u32 = 0,
    silence: u32 = 0,

    pub fn init(cfg: Config) Detector {
        return .{ .cfg = cfg };
    }

    pub fn reset(self: *Detector) void {
        self.in_speech = false;
        self.attack = 0;
        self.silence = 0;
    }

    pub fn frame(self: *Detector, samples: []const i16) Event {
        const rms = frameRms(samples);
        if (self.in_speech) {
            if (rms >= self.cfg.release_rms) {
                self.silence = 0;
                return .speech_continue;
            }
            self.silence += 1;
            if (self.silence >= self.cfg.hangover_frames) {
                self.in_speech = false;
                self.attack = 0;
                self.silence = 0;
                return .speech_end;
            }
            return .speech_continue;
        }
        if (rms >= self.cfg.speech_rms) {
            self.attack += 1;
            if (self.attack >= self.cfg.attack_frames) {
                self.in_speech = true;
                self.silence = 0;
                return .speech_start;
            }
            return .silence;
        }
        self.attack = 0;
        return .silence;
    }

    pub fn frameRms(samples: []const i16) f32 {
        if (samples.len == 0) return 0;
        var sum: f64 = 0;
        for (samples) |s| {
            const v: f64 = @floatFromInt(s);
            sum += v * v;
        }
        return @floatCast(@sqrt(sum / @as(f64, @floatFromInt(samples.len))));
    }
};

fn vadEnvFloat(name: [*:0]const u8) ?f32 {
    const raw = std.c.getenv(name) orelse return null;
    return std.fmt.parseFloat(f32, std.mem.span(raw)) catch null;
}

fn vadEnvU32(name: [*:0]const u8) ?u32 {
    const raw = std.c.getenv(name) orelse return null;
    return std.fmt.parseInt(u32, std.mem.span(raw), 10) catch null;
}
