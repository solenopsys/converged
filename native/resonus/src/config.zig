const std = @import("std");

pub const Config = struct {
    allocator: std.mem.Allocator,

    http_host: []u8,
    http_port: u16,

    openai_api_key: ?[]u8,
    openai_model: []u8,
    openai_voice: []u8,
    openai_transcription_model: []u8,
    openai_noise_reduction: []u8,
    // No hardcoded instructions or language: both come from the per-call call
    // context (see ms-calls ContextStoreService). No context => the call is
    // refused, never answered with a generic prompt.
    openai_realtime_calls_url: []u8,
    openai_safety_identifier: ?[]u8,
    openai_vad_threshold: f32,
    openai_vad_silence_ms: u32,
    openai_vad_prefix_ms: u32,
    openai_vad_interrupt: bool,

    qjs_lib_path: []u8,
    policy_script_path: []u8,
    policy_required: bool,

    gemini_api_key: ?[]u8,
    gemini_model: []u8,
    gemini_ws_url: []u8,
    gemini_sdp_url: ?[]u8,

    converged_root: []u8,

    baresip_lib_path: []u8,
    baresip_wrapper_lib_path: []u8,
    libdatachannel_lib_path: []u8,
    libdatachannel_wrapper_lib_path: []u8,
    mbedtls_lib_path: []u8,

    services_url: []u8,
    services_token: ?[]u8,
    valkey_url: []u8,
    valkey_key_prefix: []u8,
    valkey_ttl_seconds: u32,

    sip_enabled: bool,
    sip_port: u16,
    sip_public_ip: []u8,
    // Digest credentials for OUTBOUND calls on the provider trunk (human
    // transfer). Optional, but strictly paired: one without the other is a
    // config error. Absent => IP-auth trunk (401/407 then fails the call).
    sip_auth_user: ?[]u8,
    sip_auth_password: ?[]u8,
    stun_url: []u8,
    ice_port_range_begin: u16,
    ice_port_range_end: u16,

    pub fn init(allocator: std.mem.Allocator, environ: *const std.process.Environ.Map) !Config {
        var cfg = Config{
            .allocator = allocator,
            .http_host = try envOwnedOrDefault(allocator, environ, "LLM_GATE_HTTP_HOST", "0.0.0.0"),
            .http_port = try envU16OrDefault(allocator, environ, "LLM_GATE_HTTP_PORT", 8090),
            .openai_api_key = try envOwnedOptional(allocator, environ, "OPENAI_API_KEY"),
            .openai_model = try envOwnedOrDefault(allocator, environ, "OPENAI_REALTIME_MODEL", "gpt-realtime-2.1"),
            .openai_voice = try envOwnedOrDefaultAny(allocator, environ, &.{ "OPENAI_REALTIME_VOICE", "OPENAI_VOICE" }, "marin"),
            .openai_transcription_model = try envOwnedOrDefault(allocator, environ, "OPENAI_REALTIME_TRANSCRIPTION_MODEL", "gpt-4o-transcribe"),
            .openai_noise_reduction = try envOwnedOrDefault(allocator, environ, "OPENAI_REALTIME_NOISE_REDUCTION", "far_field"),
            .openai_realtime_calls_url = try envOwnedOrDefaultAny(
                allocator,
                environ,
                &.{"OPENAI_REALTIME_CALLS_URL"},
                "https://api.openai.com/v1/realtime/calls",
            ),
            .openai_safety_identifier = try envOwnedOptionalTrimmed(allocator, environ, "OPENAI_SAFETY_IDENTIFIER"),
            .openai_vad_threshold = blk: {
                const s = environ.get("OPENAI_REALTIME_VAD_THRESHOLD") orelse "0.8";
                break :blk std.fmt.parseFloat(f32, s) catch 0.8;
            },
            .openai_vad_silence_ms = blk: {
                const s = environ.get("OPENAI_REALTIME_VAD_SILENCE_MS") orelse "600";
                break :blk std.fmt.parseInt(u32, s, 10) catch 600;
            },
            .openai_vad_prefix_ms = blk: {
                const s = environ.get("OPENAI_REALTIME_VAD_PREFIX_MS") orelse "200";
                break :blk std.fmt.parseInt(u32, s, 10) catch 200;
            },
            .openai_vad_interrupt = blk: {
                const v = environ.get("OPENAI_REALTIME_VAD_INTERRUPT") orelse "true";
                break :blk std.mem.eql(u8, v, "true") or std.mem.eql(u8, v, "1");
            },
            .qjs_lib_path = undefined,
            .policy_script_path = try envOwnedOrDefault(allocator, environ, "LLM_GATE_POLICY_SCRIPT", "scripts/default.js"),
            .policy_required = blk: {
                const v = environ.get("LLM_GATE_POLICY_REQUIRED") orelse "true";
                break :blk std.mem.eql(u8, v, "true") or std.mem.eql(u8, v, "1");
            },
            .gemini_api_key = try envOwnedOptional(allocator, environ, "GEMINI_API_KEY"),
            .gemini_model = try envOwnedOrDefault(allocator, environ, "GEMINI_MODEL", "models/gemini-2.5-flash-preview-native-audio-dialog"),
            .gemini_ws_url = try envOwnedOrDefault(allocator, environ, "GEMINI_WS_URL", "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"),
            .gemini_sdp_url = try envOwnedOptional(allocator, environ, "GEMINI_SDP_URL"),
            .converged_root = try envOwnedOrDefault(
                allocator,
                environ,
                "LLM_GATE_CONVERGED_ROOT",
                "/home/alexstorm/distrib/4ir/gestalt/clarity/projects/converged-portal",
            ),
            .baresip_lib_path = undefined,
            .baresip_wrapper_lib_path = undefined,
            .libdatachannel_lib_path = undefined,
            .libdatachannel_wrapper_lib_path = undefined,
            .mbedtls_lib_path = undefined,
            .services_url = try envOwnedOrDefaultAny(allocator, environ, &.{ "LLM_GATE_SERVICES_URL", "LLM_GATE_THREADS_SERVICE_URL" }, "http://127.0.0.1:3000/services"),
            .services_token = try envOwnedOptionalTrimmedAny(allocator, environ, &.{ "LLM_GATE_SERVICES_TOKEN", "LLM_GATE_THREADS_SERVICE_TOKEN", "NRPC_SERVICE_TOKEN" }),
            .valkey_url = try envOwnedOrDefaultAny(allocator, environ, &.{ "LLM_GATE_VALKEY_URL", "VALKEY_URL", "REDIS_URL", "RUNTIME_CACHE_URL" }, "redis://127.0.0.1:6379/0"),
            .valkey_key_prefix = try envOwnedOrDefaultAny(allocator, environ, &.{ "LLM_GATE_VALKEY_KEY_PREFIX", "RUNTIME_CACHE_KEY_PREFIX" }, "cache"),
            .valkey_ttl_seconds = try envU32OrDefault(allocator, environ, "LLM_GATE_VALKEY_TTL_SECONDS", 120),
            .sip_enabled = blk: {
                const v = environ.get("LLM_GATE_SIP_ENABLED") orelse "false";
                break :blk std.mem.eql(u8, v, "true") or std.mem.eql(u8, v, "1");
            },
            .sip_port = try envU16OrDefault(allocator, environ, "LLM_GATE_SIP_PORT", 5060),
            .sip_public_ip = try envOwnedOrDefault(allocator, environ, "LLM_GATE_SIP_PUBLIC_IP", "127.0.0.1"),
            .sip_auth_user = try envOwnedOptionalTrimmed(allocator, environ, "LLM_GATE_SIP_AUTH_USER"),
            .sip_auth_password = try envOwnedOptionalTrimmed(allocator, environ, "LLM_GATE_SIP_AUTH_PASSWORD"),
            .stun_url = try envOwnedOrDefault(allocator, environ, "LLM_GATE_STUN_URL", "stun:stun.l.google.com:19302"),
            .ice_port_range_begin = try envU16OrDefault(allocator, environ, "LLM_GATE_ICE_PORT_RANGE_BEGIN", 0),
            .ice_port_range_end = try envU16OrDefault(allocator, environ, "LLM_GATE_ICE_PORT_RANGE_END", 0),
        };
        if ((cfg.ice_port_range_begin == 0) != (cfg.ice_port_range_end == 0) or
            (cfg.ice_port_range_begin != 0 and cfg.ice_port_range_begin > cfg.ice_port_range_end))
        {
            return error.InvalidIcePortRange;
        }
        if ((cfg.sip_auth_user == null) != (cfg.sip_auth_password == null)) {
            return error.SipAuthCredentialsIncomplete;
        }

        cfg.baresip_lib_path = try envOwnedOrDerived(
            allocator,
            environ,
            "LLM_GATE_BARESIP_LIB",
            "{s}/native/wrapers/baresip/zig-out/lib/libbaresip.so",
            .{cfg.converged_root},
        );
        cfg.libdatachannel_lib_path = try envOwnedOrDerived(
            allocator,
            environ,
            "LLM_GATE_LIBDATACHANNEL_LIB",
            "{s}/native/wrapers/libdatachannel/zig-out/lib/libdatachannel.so",
            .{cfg.converged_root},
        );
        cfg.baresip_wrapper_lib_path = try envOwnedOrDerived(
            allocator,
            environ,
            "LLM_GATE_BARESIP_WRAPPER_LIB",
            "{s}/native/wrapers/baresip/zig-out/lib/libbaresip_wrapper.so",
            .{cfg.converged_root},
        );
        cfg.libdatachannel_wrapper_lib_path = try envOwnedOrDerived(
            allocator,
            environ,
            "LLM_GATE_LIBDATACHANNEL_WRAPPER_LIB",
            "{s}/native/wrapers/libdatachannel/zig-out/lib/libdatachannel_wrapper.so",
            .{cfg.converged_root},
        );
        cfg.mbedtls_lib_path = try envOwnedOrDerived(
            allocator,
            environ,
            "LLM_GATE_MBEDTLS_LIB",
            "{s}/native/wrapers/mbedtls/zig-out/lib/libmbedtls.so",
            .{cfg.converged_root},
        );
        cfg.qjs_lib_path = try envOwnedOrDerived(
            allocator,
            environ,
            "LLM_GATE_QJS_LIB",
            "{s}/native/wrapers/qjs/zig-out/lib/libqjs.so",
            .{cfg.converged_root},
        );
        return cfg;
    }

    pub fn deinit(self: *Config) void {
        const a = self.allocator;

        a.free(self.http_host);

        if (self.openai_api_key) |v| a.free(v);
        a.free(self.openai_model);
        a.free(self.openai_voice);
        a.free(self.openai_transcription_model);
        a.free(self.openai_noise_reduction);
        a.free(self.openai_realtime_calls_url);
        if (self.openai_safety_identifier) |v| a.free(v);
        a.free(self.qjs_lib_path);
        a.free(self.policy_script_path);

        if (self.gemini_api_key) |v| a.free(v);
        a.free(self.gemini_model);
        a.free(self.gemini_ws_url);
        if (self.gemini_sdp_url) |v| a.free(v);

        a.free(self.converged_root);

        a.free(self.baresip_lib_path);
        a.free(self.baresip_wrapper_lib_path);
        a.free(self.libdatachannel_lib_path);
        a.free(self.libdatachannel_wrapper_lib_path);
        a.free(self.mbedtls_lib_path);

        a.free(self.services_url);
        if (self.services_token) |v| a.free(v);
        a.free(self.valkey_url);
        a.free(self.valkey_key_prefix);
        a.free(self.sip_public_ip);
        if (self.sip_auth_user) |v| a.free(v);
        if (self.sip_auth_password) |v| a.free(v);
        a.free(self.stun_url);

        self.* = undefined;
    }
};

fn envOwnedOrDefault(allocator: std.mem.Allocator, environ: *const std.process.Environ.Map, key: []const u8, default_value: []const u8) ![]u8 {
    return if (environ.get(key)) |value|
        try allocator.dupe(u8, value)
    else
        try allocator.dupe(u8, default_value);
}

fn envOwnedOptional(allocator: std.mem.Allocator, environ: *const std.process.Environ.Map, key: []const u8) !?[]u8 {
    return if (environ.get(key)) |value| try allocator.dupe(u8, value) else null;
}

fn envOwnedOptionalTrimmed(allocator: std.mem.Allocator, environ: *const std.process.Environ.Map, key: []const u8) !?[]u8 {
    if (environ.get(key)) |value| {
        const trimmed = std.mem.trim(u8, value, " \t\r\n");
        if (trimmed.len == 0) return null;
        return try allocator.dupe(u8, trimmed);
    }
    return null;
}

fn envOwnedOptionalTrimmedAny(allocator: std.mem.Allocator, environ: *const std.process.Environ.Map, keys: []const []const u8) !?[]u8 {
    for (keys) |key| {
        if (try envOwnedOptionalTrimmed(allocator, environ, key)) |value| return value;
    }
    return null;
}

fn envOwnedOrDefaultAny(
    allocator: std.mem.Allocator,
    environ: *const std.process.Environ.Map,
    keys: []const []const u8,
    default_value: []const u8,
) ![]u8 {
    for (keys) |key| {
        if (environ.get(key)) |value| {
            const trimmed = std.mem.trim(u8, value, " \t\r\n");
            if (trimmed.len != 0) return try allocator.dupe(u8, trimmed);
        }
    }
    return try allocator.dupe(u8, default_value);
}

fn envU16OrDefault(allocator: std.mem.Allocator, environ: *const std.process.Environ.Map, key: []const u8, default_value: u16) !u16 {
    const maybe = try envOwnedOptional(allocator, environ, key);
    if (maybe) |value| {
        defer allocator.free(value);
        return try std.fmt.parseInt(u16, value, 10);
    }
    return default_value;
}

fn envU32OrDefault(allocator: std.mem.Allocator, environ: *const std.process.Environ.Map, key: []const u8, default_value: u32) !u32 {
    const maybe = try envOwnedOptional(allocator, environ, key);
    if (maybe) |value| {
        defer allocator.free(value);
        const trimmed = std.mem.trim(u8, value, " \t\r\n");
        if (trimmed.len != 0) return try std.fmt.parseInt(u32, trimmed, 10);
    }
    return default_value;
}

fn envU16Required(allocator: std.mem.Allocator, environ: *const std.process.Environ.Map, key: []const u8) !u16 {
    const maybe = try envOwnedOptional(allocator, environ, key);
    if (maybe) |value| {
        defer allocator.free(value);
        const trimmed = std.mem.trim(u8, value, " \t\r\n");
        if (trimmed.len == 0) return error.MissingRequiredEnv;
        return try std.fmt.parseInt(u16, trimmed, 10);
    }
    return error.MissingRequiredEnv;
}

fn envU16OrDefaultAny(
    allocator: std.mem.Allocator,
    environ: *const std.process.Environ.Map,
    keys: []const []const u8,
    default_value: u16,
) !u16 {
    for (keys) |key| {
        const maybe = try envOwnedOptional(allocator, environ, key);
        if (maybe) |value| {
            defer allocator.free(value);
            const trimmed = std.mem.trim(u8, value, " \t\r\n");
            if (trimmed.len != 0) return try std.fmt.parseInt(u16, trimmed, 10);
        }
    }
    return default_value;
}

fn envOwnedOrDerived(
    allocator: std.mem.Allocator,
    environ: *const std.process.Environ.Map,
    key: []const u8,
    comptime fmt: []const u8,
    args: anytype,
) ![]u8 {
    const maybe = try envOwnedOptional(allocator, environ, key);
    if (maybe) |value| return value;
    return try std.fmt.allocPrint(allocator, fmt, args);
}
