//! Dumb environment access. The RT reads only a handful of bootstrap values
//! (where the service gateway is, where Valkey is). No config parsing happens
//! here — formalized parameters arrive from microservices at runtime, not from
//! files the VM has to interpret. Missing required values fail loudly.

const std = @import("std");

pub const EnvError = error{MissingEnv};

pub fn opt(name: [:0]const u8) ?[]const u8 {
    const v = std.c.getenv(name.ptr) orelse return null;
    const s = std.mem.span(v);
    return if (s.len == 0) null else s;
}

pub fn require(name: [:0]const u8) EnvError![]const u8 {
    return opt(name) orelse {
        std.debug.print("centimanus: missing required env {s}\n", .{name});
        return error.MissingEnv;
    };
}

pub fn requirePort(name: [:0]const u8) !u16 {
    const v = try require(name);
    return std.fmt.parseInt(u16, v, 10) catch {
        std.debug.print("centimanus: env {s}='{s}' is not a valid port\n", .{ name, v });
        return error.MissingEnv;
    };
}
